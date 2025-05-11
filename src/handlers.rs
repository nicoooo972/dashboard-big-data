use axum::{
    extract::State,
    http::StatusCode,
    response::{Html, IntoResponse},
    routing::get,
    Json,
    Router,
    http::{header, HeaderMap, HeaderValue},
};
use diesel::prelude::*;
use crate::db::DbPool;
use crate::models::{AggregatedTripStats, PaymentTypeAnalysis, HourlyWeekdayActivity, PassengerAnalysis, FinancialBreakdown, VendorAnalysis, KpiTrendData, TrendValue, ZoneActivity, RateCodeAnalysis, TripDurationStats, FareEfficiencyStats, BoroughFlowStats };
use chrono::{NaiveDate, Duration, Datelike};
use std::collections::HashMap;

// Handler to serve the main HTML page
pub async fn root_handler() -> Html<String> {
    let html_content = tokio::fs::read_to_string("templates/index.html")
        .await
        .unwrap_or_else(|_| "<html><body><h1>Error loading page</h1></body></html>".to_string());
    Html(html_content)
}

// Updated handler for the API endpoint
pub async fn get_trip_volume_data(
    State(pool): State<DbPool>,
) -> Result<Json<Vec<AggregatedTripStats>>, AppError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection from pool: {}", e);
        AppError(anyhow::Error::new(e))
    })?;

    let results = tokio::task::spawn_blocking(move || {
        diesel::sql_query(
            "SELECT \
                d.full_date::date as date, \
                COUNT(f.trip_id)::bigint AS trip_count, \
                COALESCE(AVG(f.total_amount), 0.0)::float8 AS avg_total_amount, \
                COALESCE(AVG(f.tip_amount), 0.0)::float8 AS avg_tip_amount, \
                COALESCE(AVG(f.trip_distance), 0.0)::float8 AS avg_trip_distance, \
                COALESCE(AVG(EXTRACT(EPOCH FROM f.trip_duration)), 0.0)::float8 AS avg_trip_duration_seconds \
            FROM fact_trips f \
            JOIN dim_date d ON f.pickup_date_key = d.date_key \
            GROUP BY d.full_date \
            ORDER BY d.full_date"
        )
        .load::<AggregatedTripStats>(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Spawn blocking task failed: {}", e);
        AppError(anyhow::Error::new(e))
    })??;

    Ok(Json(results))
}

// Nouveau handler pour l'analyse par type de paiement
pub async fn get_payment_analysis_data(
    State(pool): State<DbPool>,
) -> Result<Json<Vec<PaymentTypeAnalysis>>, AppError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection from pool: {}", e);
        AppError(anyhow::Error::new(e))
    })?;

    let results = tokio::task::spawn_blocking(move || {
        diesel::sql_query(
            "SELECT \
                COALESCE(pt.payment_type_name, 'Inconnu') as payment_type_name, \
                COUNT(f.trip_id)::bigint AS trip_count, \
                COALESCE(AVG(f.tip_amount), 0.0)::float8 AS avg_tip_amount \
            FROM fact_trips f \
            LEFT JOIN dim_payment_type pt ON f.payment_type_key = pt.payment_type_key \
            GROUP BY pt.payment_type_name \
            ORDER BY trip_count DESC" // Trier par nombre de trajets
        )
        .load::<PaymentTypeAnalysis>(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Spawn blocking task failed: {}", e);
        AppError(anyhow::Error::new(e))
    })??;

    Ok(Json(results))
}

// Nouveau handler pour l'activité horaire/jour
pub async fn get_hourly_activity_data(
    State(pool): State<DbPool>,
) -> Result<Json<Vec<HourlyWeekdayActivity>>, AppError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection from pool: {}", e);
        AppError(anyhow::Error::new(e))
    })?;

    let results = tokio::task::spawn_blocking(move || {
        diesel::sql_query(
            "SELECT \
                EXTRACT(ISODOW FROM tpep_pickup_datetime)::INTEGER AS day_of_week, \
                EXTRACT(HOUR FROM tpep_pickup_datetime)::INTEGER AS hour_of_day, \
                COUNT(trip_id)::bigint AS trip_count \
            FROM fact_trips \
            GROUP BY day_of_week, hour_of_day \
            ORDER BY day_of_week, hour_of_day"
        )
        .load::<HourlyWeekdayActivity>(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Spawn blocking task failed: {}", e);
        AppError(anyhow::Error::new(e))
    })??;

    Ok(Json(results))
}

// Handler pour analyse par nombre de passagers
pub async fn get_passenger_analysis_data(
    State(pool): State<DbPool>,
) -> Result<Json<Vec<PassengerAnalysis>>, AppError> {
    let mut conn = pool.get().map_err(|e| AppError(anyhow::Error::new(e)))?;
    let results = tokio::task::spawn_blocking(move || {
        diesel::sql_query(
            "SELECT \
                passenger_count, \
                COUNT(trip_id)::bigint AS trip_count \
            FROM fact_trips \
            GROUP BY passenger_count \
            ORDER BY passenger_count ASC"
        )
        .load::<PassengerAnalysis>(&mut conn)
    })
    .await??;
    Ok(Json(results))
}

// Handler pour la décomposition financière (par mois par défaut)
pub async fn get_financial_breakdown_data(
    State(pool): State<DbPool>,
) -> Result<Json<Vec<FinancialBreakdown>>, AppError> {
    let mut conn = pool.get().map_err(|e| AppError(anyhow::Error::new(e)))?;
    let results = tokio::task::spawn_blocking(move || {
        diesel::sql_query(
            "SELECT \
                DATE_TRUNC('month', d.full_date)::date as date, \
                COALESCE(AVG(f.fare_amount), 0.0)::float8 AS avg_fare_amount, \
                COALESCE(AVG(f.tip_amount), 0.0)::float8 AS avg_tip_amount, \
                COALESCE(AVG(f.tolls_amount), 0.0)::float8 AS avg_tolls_amount, \
                COALESCE(AVG(f.mta_tax), 0.0)::float8 AS avg_mta_tax, \
                COALESCE(AVG(f.improvement_surcharge), 0.0)::float8 AS avg_improvement_surcharge, \
                COALESCE(AVG(f.extra), 0.0)::float8 AS avg_extra, \
                COALESCE(AVG(f.total_amount), 0.0)::float8 AS avg_total_amount \
            FROM fact_trips f \
            JOIN dim_date d ON f.pickup_date_key = d.date_key \
            GROUP BY DATE_TRUNC('month', d.full_date) \
            ORDER BY date ASC"
        )
        .load::<FinancialBreakdown>(&mut conn)
    })
    .await??;
    Ok(Json(results))
}

// Handler pour analyse par vendeur (modifié)
pub async fn get_vendor_analysis_data(
    State(pool): State<DbPool>,
) -> Result<Json<Vec<VendorAnalysis>>, AppError> {
    let mut conn = pool.get().map_err(|e| AppError(anyhow::Error::new(e)))?;
    let results = tokio::task::spawn_blocking(move || {
        diesel::sql_query(
            "SELECT \
                COALESCE(NULLIF(TRIM(v.vendor_name), ''), 'Vendor ' || v.vendor_key::text, 'Inconnu') as vendor_name, \
                COUNT(f.trip_id)::bigint AS trip_count, \
                COALESCE(AVG(f.total_amount), 0.0)::float8 AS avg_total_amount, \
                COALESCE(AVG(f.trip_distance), 0.0)::float8 AS avg_trip_distance \
            FROM fact_trips f \
            LEFT JOIN dim_vendor v ON f.vendor_key = v.vendor_key \
            GROUP BY v.vendor_key, v.vendor_name \
            ORDER BY trip_count DESC"
        )
        .load::<VendorAnalysis>(&mut conn)
    })
    .await??;
    Ok(Json(results))
}

// Handler pour l'analyse par code tarifaire
pub async fn get_rate_code_analysis_data(
    State(pool): State<DbPool>,
) -> Result<Json<Vec<RateCodeAnalysis>>, AppError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection from pool: {}", e);
        AppError(anyhow::Error::new(e))
    })?;

    let results = tokio::task::spawn_blocking(move || {
        diesel::sql_query(
            "SELECT \
                COALESCE(rc.rate_code_name, 'Inconnu') as rate_code_name, \
                COUNT(f.trip_id)::bigint AS trip_count, \
                COALESCE(AVG(f.total_amount), 0.0)::float8 AS avg_total_amount, \
                COALESCE(AVG(f.trip_distance), 0.0)::float8 AS avg_trip_distance, \
                COALESCE(AVG(f.tip_amount), 0.0)::float8 AS avg_tip_amount \
            FROM fact_trips f \
            LEFT JOIN dim_rate_code rc ON f.rate_code_key = rc.rate_code_key \
            GROUP BY rc.rate_code_name \
            ORDER BY trip_count DESC"
        )
        .load::<RateCodeAnalysis>(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Spawn blocking task failed: {}", e);
        AppError(anyhow::Error::new(e))
    })??;

    Ok(Json(results))
}

// Handler pour les statistiques sur la durée des trajets
pub async fn get_trip_duration_stats_data(
    State(pool): State<DbPool>,
) -> Result<Json<TripDurationStats>, AppError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection from pool: {}", e);
        AppError(anyhow::Error::new(e))
    })?;

    let results = tokio::task::spawn_blocking(move || {
        diesel::sql_query(
            "SELECT \
                COALESCE(AVG(EXTRACT(EPOCH FROM f.trip_duration)), 0.0)::float8 AS avg_duration_seconds, \
                COALESCE(MIN(EXTRACT(EPOCH FROM f.trip_duration)), 0.0)::float8 AS min_duration_seconds, \
                COALESCE(MAX(EXTRACT(EPOCH FROM f.trip_duration)), 0.0)::float8 AS max_duration_seconds, \
                COALESCE(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM f.trip_duration)), 0.0)::float8 AS p25_duration_seconds, \
                COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM f.trip_duration)), 0.0)::float8 AS p50_duration_seconds, \
                COALESCE(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM f.trip_duration)), 0.0)::float8 AS p75_duration_seconds \
            FROM fact_trips f \
            WHERE f.trip_duration IS NOT NULL AND EXTRACT(EPOCH FROM f.trip_duration) > 0"
        )
        .get_result::<TripDurationStats>(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Spawn blocking task failed: {}", e);
        AppError(anyhow::Error::new(e))
    })??;

    Ok(Json(results))
}

// Handler pour les statistiques d'efficacité tarifaire
pub async fn get_fare_efficiency_stats_data(
    State(pool): State<DbPool>,
) -> Result<Json<FareEfficiencyStats>, AppError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection from pool: {}", e);
        AppError(anyhow::Error::new(e))
    })?;

    let results = tokio::task::spawn_blocking(move || {
        diesel::sql_query(
            "SELECT \
                COALESCE(AVG(CASE WHEN f.trip_distance > 0 THEN f.fare_amount / f.trip_distance ELSE NULL END), 0.0)::float8 AS avg_fare_per_km, \
                COALESCE(AVG(CASE WHEN EXTRACT(EPOCH FROM f.trip_duration) > 0 THEN f.fare_amount / (EXTRACT(EPOCH FROM f.trip_duration) / 60.0) ELSE NULL END), 0.0)::float8 AS avg_fare_per_minute \
            FROM fact_trips f"
        )
        .get_result::<FareEfficiencyStats>(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Spawn blocking task failed for fare efficiency: {}", e);
        AppError(anyhow::Error::new(e))
    })??;

    Ok(Json(results))
}

// Handler pour calculer les tendances KPI (Amélioré)
pub async fn get_kpi_trend_data(
    State(pool): State<DbPool>,
) -> Result<Json<KpiTrendData>, AppError> {
    let pool_clone = pool.clone();
    
    let current_stats = tokio::task::spawn_blocking(move || {
        let mut conn = pool_clone.get().map_err(|e| AppError(anyhow::Error::new(e)))?;
        
        diesel::sql_query(
            "SELECT \
                COALESCE(MAX(d.full_date), CURRENT_DATE)::date as date, \
                COALESCE(COUNT(f.trip_id), 0)::bigint AS trip_count, \
                COALESCE(AVG(f.total_amount), 0.0)::float8 AS avg_total_amount, \
                0.0::float8 AS avg_tip_amount, \
                0.0::float8 AS avg_trip_distance, \
                0.0::float8 AS avg_trip_duration_seconds \
            FROM fact_trips f \
            RIGHT JOIN dim_date d ON f.pickup_date_key = d.date_key \
            WHERE d.year = 2024 AND d.month >= 10"
        )
        .get_result::<AggregatedTripStats>(&mut conn)
        .map_err(|e| AppError(anyhow::Error::new(e)))
    })
    .await??;
    
    let pool_clone = pool.clone();
    let monthly_stats = tokio::task::spawn_blocking(move || -> Result<AggregatedTripStats, AppError> {
        let mut conn = pool_clone.get().map_err(|e| AppError(anyhow::Error::new(e)))?;
        
        let result = diesel::sql_query(
            "WITH monthly_data AS (
                SELECT \
                    DATE_TRUNC('month', d.full_date)::date as date, \
                    COUNT(f.trip_id) AS trip_count, \
                    AVG(f.total_amount) AS avg_total_amount, \
                    AVG(f.tip_amount) AS avg_tip_amount, \
                    AVG(f.trip_distance) AS avg_trip_distance, \
                    AVG(EXTRACT(EPOCH FROM f.trip_duration)) AS avg_trip_duration_seconds \
                FROM fact_trips f \
                RIGHT JOIN dim_date d ON f.pickup_date_key = d.date_key \
                WHERE d.year = 2024 AND d.month >= 10 \
                GROUP BY DATE_TRUNC('month', d.full_date) \
                ORDER BY trip_count DESC \
                LIMIT 1
            )
            SELECT \
                COALESCE(date, DATE_TRUNC('month', CURRENT_DATE)::date) as date, \
                COALESCE(trip_count, 0)::bigint AS trip_count, \
                COALESCE(avg_total_amount, 0.0)::float8 AS avg_total_amount, \
                COALESCE(avg_tip_amount, 0.0)::float8 AS avg_tip_amount, \
                COALESCE(avg_trip_distance, 0.0)::float8 AS avg_trip_distance, \
                COALESCE(avg_trip_duration_seconds, 0.0)::float8 AS avg_trip_duration_seconds \
            FROM monthly_data \
            UNION ALL \
            SELECT \
                DATE_TRUNC('month', CURRENT_DATE)::date as date, \
                0::bigint AS trip_count, \
                0.0::float8 AS avg_total_amount, \
                0.0::float8 AS avg_tip_amount, \
                0.0::float8 AS avg_trip_distance, \
                0.0::float8 AS avg_trip_duration_seconds \
            WHERE NOT EXISTS (SELECT 1 FROM monthly_data) \
            LIMIT 1"
        )
        .get_result::<AggregatedTripStats>(&mut conn)
        .optional()
        .map_err(|e| AppError(anyhow::Error::new(e)))?;
        
        Ok(result.unwrap_or_else(|| AggregatedTripStats {
            date: chrono::Local::now().date_naive(),
            trip_count: 0,
            avg_total_amount: 0.0,
            avg_tip_amount: 0.0,
            avg_trip_distance: 0.0,
            avg_trip_duration_seconds: 0.0,
        }))
    })
    .await??;
    
    let total_trips = current_stats.trip_count as f64;
    let avg_trips_per_month = if total_trips > 0.0 { total_trips / 3.0 } else { 0.0 };
    
    let max_trips_per_month = monthly_stats.trip_count as f64;

    let trend_data = KpiTrendData {
        total_trips: TrendValue {
            current: total_trips,
            previous: Some(0.0),
            trend: Some(0.0),
        },
        avg_trips_per_period: TrendValue { 
            current: avg_trips_per_month, 
            previous: Some(0.0),
            trend: Some(0.0),
        },
        max_trips_per_period: TrendValue { 
            current: max_trips_per_month, 
            previous: Some(0.0),
            trend: Some(0.0),
        },
        avg_amount_overall: TrendValue {
            current: current_stats.avg_total_amount,
            previous: Some(0.0),
            trend: Some(0.0),
        },
    };

    Ok(Json(trend_data))
}

// Handler pour l'analyse par zone de départ
pub async fn get_zone_activity_data(
    State(pool): State<DbPool>,
) -> Result<Json<Vec<ZoneActivity>>, AppError> {
    let mut conn = pool.get().map_err(|e| AppError(anyhow::Error::new(e)))?;

    let results = tokio::task::spawn_blocking(move || {
        diesel::sql_query(
            "SELECT \
                loc.location_id, \
                loc.zone, \
                loc.borough, \
                COUNT(f.trip_id)::bigint AS trip_count, \
                COALESCE(AVG(f.total_amount), 0.0)::float8 AS avg_total_amount \
            FROM fact_trips f \
            LEFT JOIN dim_location loc ON f.pickup_location_key = loc.location_key \
            GROUP BY loc.location_id, loc.zone, loc.borough \
            ORDER BY trip_count DESC"
        )
        .load::<ZoneActivity>(&mut conn)
    })
    .await??;

    Ok(Json(results))
}

// Handler pour les flux de trajets entre arrondissements
pub async fn get_borough_flows_data(
    State(pool): State<DbPool>,
) -> Result<Json<Vec<BoroughFlowStats>>, AppError> {
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection from pool: {}", e);
        AppError(anyhow::Error::new(e))
    })?;

    let results = tokio::task::spawn_blocking(move || {
        diesel::sql_query(
            "SELECT \
                COALESCE(pul.borough, 'Inconnu') AS pickup_borough, \
                COALESCE(dol.borough, 'Inconnu') AS dropoff_borough, \
                COUNT(f.trip_id)::bigint AS trip_count, \
                COALESCE(AVG(f.fare_amount), 0.0)::float8 AS avg_fare_amount \
            FROM fact_trips f \
            LEFT JOIN dim_location pul ON f.pickup_location_key = pul.location_key \
            LEFT JOIN dim_location dol ON f.dropoff_location_key = dol.location_key \
            WHERE pul.borough IS NOT NULL AND dol.borough IS NOT NULL AND pul.borough != 'Unknown' AND dol.borough != 'Unknown' AND pul.borough != '' AND dol.borough != '' \
            GROUP BY pul.borough, dol.borough \
            ORDER BY trip_count DESC \
            LIMIT 100"
        )
        .load::<BoroughFlowStats>(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::error!("Spawn blocking task failed for borough flows: {}", e);
        AppError(anyhow::Error::new(e))
    })??;

    Ok(Json(results))
}

// Centralized error handling for handlers
#[derive(Debug)]
pub struct AppError(anyhow::Error);

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        tracing::error!("Application error: {:#}", self.0);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Something went wrong: {}", self.0),
        )
            .into_response()
    }
}

// Conversions for different types of errors
impl From<diesel::result::Error> for AppError {
    fn from(err: diesel::result::Error) -> Self {
        AppError(anyhow::Error::new(err).context("Database query failed"))
    }
}

impl From<r2d2::Error> for AppError {
    fn from(err: r2d2::Error) -> Self {
        AppError(anyhow::Error::new(err).context("Database pool error"))
    }
}

impl From<tokio::task::JoinError> for AppError {
    fn from(err: tokio::task::JoinError) -> Self {
        AppError(anyhow::Error::new(err).context("Tokio blocking task failed"))
    }
}
