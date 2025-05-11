# DataViz - Analyse et Visualisation de Données de Trajets

## Description

DataViz est une application web full-stack conçue pour analyser et visualiser des données de trajets (par exemple, courses de taxi). Elle offre un backend robuste développé en Rust avec le framework Axum, et un frontend interactif construit avec Yew (compilé en WebAssembly). La persistance des données est gérée par Diesel ORM avec une base de données PostgreSQL.

L'application fournit diverses API pour agréger et analyser les données, qui sont ensuite présentées sous forme de graphiques et de tableaux sur l'interface utilisateur.

## Fonctionnalités Principales

*   **API Backend :**
    *   Volume des trajets (total, montants moyens, distances, durées)
    *   Analyse par type de paiement (nombre de trajets, pourboire moyen)
    *   Activité horaire et journalière
    *   Analyse par nombre de passagers
    *   Décomposition financière (montants moyens par période)
    *   Analyse par vendeur
    *   Analyse par code tarifaire
    *   Statistiques sur la durée des trajets (moyenne, min, max, percentiles)
    *   Statistiques d'efficacité tarifaire (tarif/km, tarif/minute)
    *   Tendances des indicateurs clés de performance (KPI)
    *   Activité par zone géographique (nombre de trajets, montants moyens)
    *   Flux de trajets entre arrondissements (pickup/dropoff)
*   **Frontend Interactif :**
    *   Tableau de bord avec multiples visualisations (graphiques, cartes d'information).
    *   Affichage des statistiques de durée et d'efficacité via des composants WASM.
    *   (Extension future possible pour d'autres visualisations et interactions).

## Stack Technique

*   **Backend :**
    *   Langage : Rust
    *   Framework Web : Axum
    *   ORM : Diesel
    *   Base de données : PostgreSQL
    *   Asynchrone : Tokio
    *   Logging : Tracing
*   **Frontend :**
    *   Langage : Rust
    *   Framework : Yew
    *   Compilation : WebAssembly (via `wasm-pack`)
    *   Visualisation : Chart.js (utilisé côté client, potentiellement via des bindings Yew ou JS direct)
*   **Autres :**
    *   Gestion des migrations BDD : `diesel_cli`

## Prérequis

Avant de commencer, assurez-vous d'avoir installé les outils suivants :

*   **Rust** : (https://www.rust-lang.org/tools/install)
*   **wasm-pack** : `cargo install wasm-pack` (Pour compiler le frontend Yew)
*   **PostgreSQL** : Serveur de base de données (https://www.postgresql.org/download/)
*   **diesel_cli** : `cargo install diesel_cli --no-default-features --features postgres` (Pour gérer les migrations de base de données)
*   Un client `psql` pour interagir avec la base de données (généralement inclus avec PostgreSQL).
*   (Optionnel) Node.js si vous utilisez des outils JS/npm pour la gestion du frontend ou des assets statiques (non détaillé ici, mais `static/pkg/package.json` le suggère pour la partie WASM).

## Configuration

1.  **Variable d'environnement `DATABASE_URL` :**
    L'application nécessite que la variable d'environnement `DATABASE_URL` soit définie pour se connecter à PostgreSQL. Créez un fichier `.env` à la racine du projet avec le contenu suivant, en adaptant les identifiants :
    ```env
    DATABASE_URL=postgres://VOTRE_USER:VOTRE_PASS@localhost/votre_db_data_viz
    ```
    *Remplacez `VOTRE_USER`, `VOTRE_PASS`, et `votre_db_data_viz` par vos informations.*

## Installation et Lancement

### 1. Configuration de la Base de Données

Assurez-vous que votre serveur PostgreSQL est en cours d'exécution.

*   **Créez la base de données** (si elle n'existe pas déjà). Vous pouvez utiliser `createdb votre_db_data_viz` avec `psql` ou un outil d'administration de base de données.

*   **Installez `diesel_cli`** (si ce n'est pas déjà fait) :
    ```bash
    cargo install diesel_cli --no-default-features --features postgres
    ```

*   **Exécutez les migrations Diesel** pour configurer le schéma de la base de données. À la racine du projet :
    ```bash
    diesel setup
    diesel migration run
    ```
    *(Note : `diesel.toml` et le répertoire `migrations/` doivent être présents).*

### 2. Compilation du Frontend Yew

Le code frontend Yew se trouve dans le répertoire `frontend_yew/`. Il doit être compilé en WebAssembly.

*   Naviguez vers le répertoire du frontend :
    ```bash
    cd frontend_yew
    ```
*   Compilez avec `wasm-pack`. La cible est généralement `web` pour générer les fichiers JS et WASM compatibles avec les navigateurs. Les fichiers résultants devraient être placés dans `static/pkg/` (ou un chemin similaire configuré pour être servi par Axum).
    ```bash
    wasm-pack build --target web --out-dir ../static/pkg --out-name frontend_yew
    ```
    *(Adaptez `--out-dir` et `--out-name` si nécessaire pour correspondre à la configuration de service des fichiers statiques dans Axum et aux imports dans `index.html`)*.
*   Retournez à la racine du projet :
    ```bash
    cd ..
    ```

### 3. Lancement du Serveur Backend

Une fois la base de données configurée et le frontend compilé :

*   Compilez et lancez le serveur Axum depuis la racine du projet :
    ```bash
    cargo run
    ```
    *(Assurez-vous que le fichier `.env` avec `DATABASE_URL` est bien lu par l'application au démarrage).*

*   Ouvrez votre navigateur et allez sur `http://127.0.0.1:3000` (ou l'adresse et le port configurés dans `src/main.rs`).

## Structure du Projet (Aperçu)

```
.
├── Cargo.toml        # Manifeste du projet backend Rust
├── Cargo.lock        # Fichier de verrouillage des dépendances
├── diesel.toml       # Configuration de Diesel CLI
├── frontend_yew/     # Code source du frontend Yew (crate Rust séparée)
│   ├── Cargo.toml
│   └── src/
│       └── lib.rs    # Logique principale du frontend Yew
├── migrations/       # Migrations de base de données Diesel
├── src/              # Code source du backend Axum
│   ├── main.rs       # Point d'entrée du serveur backend
│   ├── handlers.rs   # Gestionnaires de requêtes Axum
│   ├── models.rs     # Structures de données (souvent pour Diesel et l'API)
│   ├── db.rs         # Configuration de la connexion à la base de données
│   └── schema.rs     # Schéma de base de données généré par Diesel
├── static/           # Fichiers statiques (CSS, JS, images)
│   ├── pkg/          # Sortie de la compilation WASM du frontend
│   │   ├── frontend_yew_bg.wasm
│   │   └── frontend_yew.js
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── chart.js  # Librairie Chart.js
├── templates/        # Templates HTML (servis par Axum)
│   └── index.html    # Page HTML principale
├── .env              # (À créer) Variables d'environnement (ex: DATABASE_URL)
├── .gitignore        # Fichiers ignorés par Git
└── README.md         # Ce fichier
```

---

*(Ce README est une suggestion basée sur l'analyse du projet. N'hésitez pas à le modifier et à l'améliorer !)* 