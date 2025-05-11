// @generated automatically by Diesel CLI.

diesel::table! {
    dim_date (date_key) {
        date_key -> Int4,
        full_date -> Date,
        year -> Int4,
        month -> Int4,
        day -> Int4,
        day_of_week -> Int4,
        #[max_length = 10]
        day_name -> Varchar,
        #[max_length = 10]
        month_name -> Varchar,
        quarter -> Int4,
        is_weekend -> Bool,
    }
}

diesel::table! {
    dim_location (location_key) {
        location_key -> Int4,
        location_id -> Nullable<Int4>,
        #[max_length = 255]
        borough -> Nullable<Varchar>,
        #[max_length = 255]
        zone -> Nullable<Varchar>,
        #[max_length = 255]
        service_zone -> Nullable<Varchar>,
    }
}

diesel::table! {
    dim_payment_type (payment_type_key) {
        payment_type_key -> Int4,
        payment_type_id -> Nullable<Int4>,
        #[max_length = 255]
        payment_type_name -> Nullable<Varchar>,
    }
}

diesel::table! {
    dim_rate_code (rate_code_key) {
        rate_code_key -> Int4,
        rate_code_id -> Nullable<Int4>,
        #[max_length = 255]
        rate_code_name -> Nullable<Varchar>,
    }
}

diesel::table! {
    dim_vendor (vendor_key) {
        vendor_key -> Int4,
        vendor_id -> Nullable<Int4>,
        #[max_length = 255]
        vendor_name -> Nullable<Varchar>,
    }
}

diesel::table! {
    fact_trips (trip_id) {
        trip_id -> Int8,
        vendor_key -> Nullable<Int4>,
        pickup_date_key -> Nullable<Int4>,
        dropoff_date_key -> Nullable<Int4>,
        pickup_location_key -> Nullable<Int4>,
        dropoff_location_key -> Nullable<Int4>,
        rate_code_key -> Nullable<Int4>,
        payment_type_key -> Nullable<Int4>,
        store_and_fwd_flag -> Nullable<Text>,
        tpep_pickup_datetime -> Nullable<Timestamp>,
        tpep_dropoff_datetime -> Nullable<Timestamp>,
        passenger_count -> Nullable<Int4>,
        trip_distance -> Nullable<Float8>,
        fare_amount -> Nullable<Float8>,
        extra -> Nullable<Float8>,
        mta_tax -> Nullable<Float8>,
        tip_amount -> Nullable<Float8>,
        tolls_amount -> Nullable<Float8>,
        improvement_surcharge -> Nullable<Float8>,
        total_amount -> Nullable<Float8>,
        congestion_surcharge -> Nullable<Float8>,
        airport_fee -> Nullable<Float8>,
        trip_duration -> Nullable<Interval>,
    }
}

diesel::joinable!(fact_trips -> dim_payment_type (payment_type_key));
diesel::joinable!(fact_trips -> dim_rate_code (rate_code_key));
diesel::joinable!(fact_trips -> dim_vendor (vendor_key));

diesel::allow_tables_to_appear_in_same_query!(
    dim_date,
    dim_location,
    dim_payment_type,
    dim_rate_code,
    dim_vendor,
    fact_trips,
);
