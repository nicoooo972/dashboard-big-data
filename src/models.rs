use diesel::prelude::*;
use chrono::NaiveDate;
// use serde::Serialize; // Removed duplicate import
use serde::{Deserialize, Serialize};
use serde_json::Value;
use diesel::deserialize::QueryableByName;
use chrono::NaiveDateTime;

// Renamed struct to reflect more data
#[derive(QueryableByName, Debug, Clone, Serialize, Default)]
#[table_name = "fact_trips"]
pub struct AggregatedTripStats {
    // Grouping key (Date)
    #[sql_type = "diesel::sql_types::Date"]
    pub date: NaiveDate,
    
    // Original count
    #[sql_type = "diesel::sql_types::BigInt"]
    pub trip_count: i64,
    
    // New average metrics (using Float8 for SQL compatibility with AVG)
    #[sql_type = "diesel::sql_types::Float8"]
    pub avg_total_amount: f64,
    
    #[sql_type = "diesel::sql_types::Float8"]
    pub avg_tip_amount: f64,
    
    #[sql_type = "diesel::sql_types::Float8"]
    pub avg_trip_distance: f64,
    
    // Average duration in seconds (epoch)
    #[sql_type = "diesel::sql_types::Float8"]
    pub avg_trip_duration_seconds: f64,
}

// Nouvelle structure pour l'analyse par type de paiement
#[derive(QueryableByName, Debug, Clone, Serialize)]
#[table_name = "dim_payment_type"]
pub struct PaymentTypeAnalysis {
    #[sql_type = "diesel::sql_types::Text"]
    pub payment_type_name: String,
    
    #[sql_type = "diesel::sql_types::BigInt"]
    pub trip_count: i64,
    
    #[sql_type = "diesel::sql_types::Float8"]
    pub avg_tip_amount: f64,
}

// Nouvelle structure pour l'activité par heure/jour
#[derive(QueryableByName, Debug, Clone, Serialize)]
#[table_name = "fact_trips"]
pub struct HourlyWeekdayActivity {
    #[sql_type = "diesel::sql_types::Integer"]
    pub day_of_week: i32, // ISO day: 1 (Lundi) - 7 (Dimanche)
    
    #[sql_type = "diesel::sql_types::Integer"]
    pub hour_of_day: i32, // Heure: 0 - 23
    
    #[sql_type = "diesel::sql_types::BigInt"]
    pub trip_count: i64,
}

// Analyse par Nombre de Passagers
#[derive(QueryableByName, Debug, Clone, Serialize)]
#[table_name = "fact_trips"]
pub struct PassengerAnalysis {
    #[sql_type = "diesel::sql_types::Nullable<diesel::sql_types::Integer>"] // Passenger count peut être NULL
    pub passenger_count: Option<i32>,
    #[sql_type = "diesel::sql_types::BigInt"]
    pub trip_count: i64,
}

// Décomposition Financière (par période)
#[derive(QueryableByName, Debug, Clone, Serialize)]
#[table_name = "fact_trips"]
pub struct FinancialBreakdown {
    #[sql_type = "diesel::sql_types::Date"]
    pub date: NaiveDate, // Ou une autre clé de période
    #[sql_type = "diesel::sql_types::Float8"]
    pub avg_fare_amount: f64,
    #[sql_type = "diesel::sql_types::Float8"]
    pub avg_tip_amount: f64,
    #[sql_type = "diesel::sql_types::Float8"]
    pub avg_tolls_amount: f64,
    #[sql_type = "diesel::sql_types::Float8"]
    pub avg_mta_tax: f64,
    #[sql_type = "diesel::sql_types::Float8"]
    pub avg_improvement_surcharge: f64,
    #[sql_type = "diesel::sql_types::Float8"]
    pub avg_extra: f64, // Autres frais
    #[sql_type = "diesel::sql_types::Float8"]
    pub avg_total_amount: f64,
}

// Analyse par Vendeur
#[derive(QueryableByName, Debug, Clone, Serialize)]
#[table_name = "dim_vendor"]
pub struct VendorAnalysis {
    #[sql_type = "diesel::sql_types::Text"]
    pub vendor_name: String,
    #[sql_type = "diesel::sql_types::BigInt"]
    pub trip_count: i64,
    #[sql_type = "diesel::sql_types::Float8"]
    pub avg_total_amount: f64,
    #[sql_type = "diesel::sql_types::Float8"]
    pub avg_trip_distance: f64,
}

// Analyse par Code Tarifaire
#[derive(QueryableByName, Debug, Clone, Serialize)]
#[table_name = "dim_rate_code"]
pub struct RateCodeAnalysis {
    #[sql_type = "diesel::sql_types::Text"]
    pub rate_code_name: String,
    #[sql_type = "diesel::sql_types::BigInt"]
    pub trip_count: i64,
    #[sql_type = "diesel::sql_types::Float8"]
    pub avg_total_amount: f64,
    #[sql_type = "diesel::sql_types::Float8"]
    pub avg_trip_distance: f64,
    #[sql_type = "diesel::sql_types::Float8"]
    pub avg_tip_amount: f64, // Ajouté pour une analyse plus complète
}

// Statistiques sur la durée des trajets
#[derive(QueryableByName, Debug, Clone, Serialize)]
#[table_name = "fact_trips"]
pub struct TripDurationStats {
    #[sql_type = "diesel::sql_types::Float8"]
    pub avg_duration_seconds: f64,
    #[sql_type = "diesel::sql_types::Float8"]
    pub min_duration_seconds: f64,
    #[sql_type = "diesel::sql_types::Float8"]
    pub max_duration_seconds: f64,
    #[sql_type = "diesel::sql_types::Float8"]
    pub p25_duration_seconds: f64,
    #[sql_type = "diesel::sql_types::Float8"]
    pub p50_duration_seconds: f64, // Median
    #[sql_type = "diesel::sql_types::Float8"]
    pub p75_duration_seconds: f64,
}

// Analyse par Zone
#[derive(QueryableByName, Debug, Clone, Serialize)]
#[table_name = "dim_location"]
pub struct ZoneActivity {
    #[sql_type = "diesel::sql_types::Nullable<diesel::sql_types::Integer>"]
    pub location_id: Option<i32>,
    #[sql_type = "diesel::sql_types::Nullable<diesel::sql_types::Text>"]
    pub zone: Option<String>,
    #[sql_type = "diesel::sql_types::Nullable<diesel::sql_types::Text>"]
    pub borough: Option<String>,
    #[sql_type = "diesel::sql_types::BigInt"]
    pub trip_count: i64,
    #[sql_type = "diesel::sql_types::Float8"]
    pub avg_total_amount: f64,
}

// Données pour Tendance KPI (valeur actuelle et précédente)
#[derive(Debug, Serialize)]
pub struct KpiTrendData {
    pub total_trips: TrendValue,
    pub avg_trips_per_period: TrendValue,
    pub max_trips_per_period: TrendValue,
    pub avg_amount_overall: TrendValue,
}

#[derive(Debug, Serialize)]
pub struct TrendValue {
    pub current: f64,       // Valeur pour la période sélectionnée
    pub previous: Option<f64>, // Valeur pour la période précédente
    pub trend: Option<f64>,    // Pourcentage de changement
}

// Statistiques sur l'efficacité tarifaire
#[derive(QueryableByName, Debug, Clone, Serialize)]
#[table_name = "fact_trips"]
pub struct FareEfficiencyStats {
    #[sql_type = "diesel::sql_types::Float8"]
    pub avg_fare_per_km: f64,
    #[sql_type = "diesel::sql_types::Float8"]
    pub avg_fare_per_minute: f64,
}

// Statistiques sur les flux entre arrondissements
#[derive(QueryableByName, Debug, Clone, Serialize)]
#[table_name = "fact_trips"]
pub struct BoroughFlowStats {
    #[sql_type = "diesel::sql_types::Text"]
    pub pickup_borough: String,
    #[sql_type = "diesel::sql_types::Text"]
    pub dropoff_borough: String,
    #[sql_type = "diesel::sql_types::BigInt"]
    pub trip_count: i64,
    #[sql_type = "diesel::sql_types::Float8"]
    pub avg_fare_amount: f64,
    // On pourrait ajouter avg_trip_duration, avg_trip_distance plus tard
}
