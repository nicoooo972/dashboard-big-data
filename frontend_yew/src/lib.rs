use yew::prelude::*;
use wasm_bindgen::prelude::*;
use gloo_net::http::Request;
use serde::Deserialize; // Pour dériver Deserialize
use wasm_bindgen_futures::spawn_local; // Pour exécuter des futures
use gloo_utils::document; // Ajout de l'import pour document
use gloo_console; // Ajout de l'import pour la macro error!

// Structure pour désérialiser la réponse JSON de l'API
#[derive(Clone, PartialEq, Deserialize, Debug)]
pub struct TripDurationStats {
    pub avg_duration_seconds: f64,
    pub min_duration_seconds: f64,
    pub max_duration_seconds: f64,
    pub p25_duration_seconds: f64,
    pub p50_duration_seconds: f64, // Median
    pub p75_duration_seconds: f64,
}

// Structure pour désérialiser les stats d'efficacité tarifaire
#[derive(Clone, PartialEq, Deserialize, Debug)]
pub struct FareEfficiencyStats {
    pub avg_fare_per_km: f64,
    pub avg_fare_per_minute: f64,
}

// Nouveau composant pour afficher l'efficacité tarifaire
#[function_component(FareEfficiencyDisplay)]
fn fare_efficiency_display() -> Html {
    let stats_state = use_state(|| None::<FareEfficiencyStats>);
    let error_state = use_state(|| None::<String>);

    {
        let stats_state = stats_state.clone();
        let error_state = error_state.clone();
        use_effect_with((), move |_unused_deps: &()| {
            spawn_local(async move {
                match Request::get("/api/fare_efficiency").send().await {
                    Ok(response) => {
                        if response.ok() {
                            match response.json::<FareEfficiencyStats>().await {
                                Ok(data) => stats_state.set(Some(data)),
                                Err(e) => error_state.set(Some(format!("Désérialisation JSON (efficacité): {}", e))),
                            }
                        } else {
                            error_state.set(Some(format!("API Efficacité (statut {}): {}", response.status(), response.status_text())));
                        }
                    }
                    Err(e) => error_state.set(Some(format!("Requête Efficacité: {}", e))),
                }
            });
            || {}
        });
    }

    html! {
        <div class="stat-section">
            <h4>{ "Efficacité Tarifaire" }</h4>
            {
                if let Some(error_message) = &*error_state {
                    html! { <p style="color: red;">{ error_message }</p> }
                } else if let Some(stats) = &*stats_state {
                    html! {
                        <div class="info-cards-wasm-grid">
                            <div class="info-card-wasm"><h3>{ "Tarif / km" }</h3><p>{ format!("€{:.2}", stats.avg_fare_per_km) }</p></div>
                            <div class="info-card-wasm"><h3>{ "Tarif / min" }</h3><p>{ format!("€{:.2}", stats.avg_fare_per_minute) }</p></div>
                        </div>
                    }
                } else {
                    html! { <p>{ "Chargement efficacité..." }</p> }
                }
            }
        </div>
    }
}

// Renommer DurationStatsApp en DashboardWidgetsApp ou similaire
// et faire en sorte qu'il appelle les deux composants d'affichage.
// ... Modification à venir pour DurationStatsApp ...

// Notre composant racine pour les statistiques de durée (MAINTENANT WIDGETS)
#[function_component(DashboardWidgetsApp)] // RENOMMÉ
fn dashboard_widgets_app() -> Html {
    // État pour stocker les statistiques de durée récupérées
    let duration_stats_state = use_state(|| None::<TripDurationStats>);
    let duration_error_state = use_state(|| None::<String>);

    {
        let duration_stats_state = duration_stats_state.clone();
        let duration_error_state = duration_error_state.clone();
        use_effect_with((), move |_unused_deps: &()| {
            spawn_local(async move {
                match Request::get("/api/trip_duration_stats").send().await {
                    Ok(response) => {
                        if response.ok() {
                            match response.json::<TripDurationStats>().await {
                                Ok(data) => {
                                    duration_stats_state.set(Some(data));
                                }
                                Err(e) => {
                                    duration_error_state.set(Some(format!("Désérialisation JSON (durée): {}", e)));
                                }
                            }
                        } else {
                            duration_error_state.set(Some(format!("API Durée (statut {}): {}", response.status(), response.status_text())));
                        }
                    }
                    Err(e) => {
                        duration_error_state.set(Some(format!("Requête Durée: {}", e)));
                    }
                }
            });
            || {}
        });
    }

    html! {
        <>
            <div class="stat-section">
                <h4>{ "Statistiques sur la Durée des Trajets" }</h4>
                {
                    if let Some(error_message) = &*duration_error_state {
                        html! { <p style="color: red;">{ error_message }</p> }
                    } else if let Some(stats) = &*duration_stats_state {
                        html! {
                            <div class="info-cards-wasm-grid">
                                <div class="info-card-wasm"><h3>{ "Moyenne" }</h3><p>{ format!("{:.0}s", stats.avg_duration_seconds) }</p></div>
                                <div class="info-card-wasm"><h3>{ "Minimale" }</h3><p>{ format!("{:.0}s", stats.min_duration_seconds) }</p></div>
                                <div class="info-card-wasm"><h3>{ "Maximale" }</h3><p>{ format!("{:.0}s", stats.max_duration_seconds) }</p></div>
                                <div class="info-card-wasm"><h3>{ "P25" }</h3><p>{ format!("{:.0}s", stats.p25_duration_seconds) }</p></div>
                                <div class="info-card-wasm"><h3>{ "P50 (Médiane)" }</h3><p>{ format!("{:.0}s", stats.p50_duration_seconds) }</p></div>
                                <div class="info-card-wasm"><h3>{ "P75" }</h3><p>{ format!("{:.0}s", stats.p75_duration_seconds) }</p></div>
                            </div>
                        }
                    } else {
                        html! { <p>{ "Chargement durée..." }</p> }
                    }
                }
            </div>
            
            <FareEfficiencyDisplay /> // Appel du nouveau composant
        </>
    }
}

// Point d'entrée pour notre application WASM
#[wasm_bindgen(start)]
pub fn run_app() {
    let mount_point = document().get_element_by_id("duration-stats-wasm-container");
    match mount_point {
        Some(element) => {
            yew::Renderer::<DashboardWidgetsApp>::with_root(element).render(); // RENOMMÉ
        }
        None => {
            gloo_console::error!("L'élément de montage 'duration-stats-wasm-container' n'a pas été trouvé.");
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}