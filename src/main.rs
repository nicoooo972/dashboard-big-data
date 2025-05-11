// src/main.rs
use axum::{
    routing::get,
    Router,
};
use std::net::SocketAddr;
use tower_http::services::ServeDir;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

// Declare modules
mod db;
mod handlers;
mod models;

#[tokio::main]
async fn main() {
    // Initialize tracing (for logging)
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "data_viz=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Create the database connection pool
    let db_pool = db::create_pool();

    // Build our application router
    let app = Router::new()
        // Route for the root page
        .route("/", get(handlers::root_handler))
        // Route for the API endpoint
        .route("/api/trip_volume", get(handlers::get_trip_volume_data))
        // Nouvelle route pour l'analyse des paiements
        .route("/api/payment_analysis", get(handlers::get_payment_analysis_data))
        // Nouvelle route pour l'activité horaire
        .route("/api/hourly_activity", get(handlers::get_hourly_activity_data))
        // Nouvelle route pour l'analyse des pourboires - RETIRÉ
        // .route("/api/tip_analysis", get(handlers::get_tip_analysis_data))
        // --- Nouvelles Routes ---
        .route("/api/passenger_analysis", get(handlers::get_passenger_analysis_data))
        .route("/api/financial_breakdown", get(handlers::get_financial_breakdown_data))
        .route("/api/vendor_analysis", get(handlers::get_vendor_analysis_data))
        .route("/api/rate_code_analysis", get(handlers::get_rate_code_analysis_data))
        .route("/api/trip_duration_stats", get(handlers::get_trip_duration_stats_data))
        .route("/api/fare_efficiency", get(handlers::get_fare_efficiency_stats_data))
        .route("/api/borough_flows", get(handlers::get_borough_flows_data))
        .route("/api/kpi_trends", get(handlers::get_kpi_trend_data))
        // Nouvelle route pour l'activité par zone
        .route("/api/zone_activity", get(handlers::get_zone_activity_data))
        // --- Fin Nouvelles Routes ---
        // --- GeoJSON Route --- RETIRÉ
        // .route("/api/geojson/taxi_zones", get(handlers::get_taxi_zones_geojson))
        // --- Fin GeoJSON Route ---
        // --- Borough List Route - RETIRÉ ---
        // .route("/api/boroughs", get(handlers::get_borough_list))
        // --- Fin Borough List Route ---
        // --- Trip Points Route --- RETIRÉ
        // .route("/api/trip_points", get(handlers::get_trip_points))
        // --- End Trip Points Route ---
        // Service to serve static files (like JS, CSS)
        .nest_service("/static", ServeDir::new("static"))
        // Add the database pool to the application state
        .with_state(db_pool);

    // Define the address to run the server on
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    tracing::debug!("listening on {}", addr);

    // Run the server
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}