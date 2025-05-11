use diesel::pg::PgConnection;
use diesel::r2d2::{self, ConnectionManager};
use std::env;

// Type alias for the connection pool
pub type DbPool = r2d2::Pool<ConnectionManager<PgConnection>>;

pub fn create_pool() -> DbPool {
    dotenv::dotenv().ok();
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let manager = ConnectionManager::<PgConnection>::new(database_url);
    // Configure the pool settings (e.g., max size)
    r2d2::Pool::builder()
        .build(manager)
        .expect("Failed to create database pool.")
}
