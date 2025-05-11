// État global pour stocker les données et les références aux graphiques
const appState = {
    rawData: [],
    filteredData: [],
    charts: {},
    dataTable: null,
    selectedYears: ['2024'], // Tableau pour stocker les années sélectionnées
    aggregation: 'month',
};

// Fonction principale pour initialiser le dashboard
async function initDashboard() {
    // Paramétrer les sélecteurs
    setupEventListeners();
    
    // Charger les données
    await fetchData();
    
    // Mettre à jour les visualisations
    updateDashboard();
    
    // Vérifier si un hash existe dans l'URL et activer la section correspondante
    handleHashChange();
}

// Configuration des écouteurs d'événements pour les filtres et les contrôles de graphiques
function setupEventListeners() {
    // Gestionnaire pour les checkboxes d'années
    document.querySelectorAll('input[name="year"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            // Récupérer toutes les années sélectionnées
            const selectedCheckboxes = document.querySelectorAll('input[name="year"]:checked');
            appState.selectedYears = Array.from(selectedCheckboxes).map(cb => cb.value);
            
            // S'assurer qu'au moins une année est sélectionnée
            if (appState.selectedYears.length === 0) {
                // Si aucune année n'est sélectionnée, réactiver celle-ci
                this.checked = true;
                appState.selectedYears = [this.value];
            }
            
            // Mettre à jour l'affichage de l'année dans l'en-tête
            if (appState.selectedYears.length === 1) {
                document.getElementById('header-year').textContent = appState.selectedYears[0];
            } else {
                document.getElementById('header-year').textContent = 'Multiples';
            }
            
            updateDashboard();
        });
    });
    
    document.getElementById('aggregation').addEventListener('change', function(e) {
        appState.aggregation = e.target.value;
        // Mettre à jour les labels dans les cartes KPI
        document.querySelectorAll('.aggregation-label').forEach(el => el.textContent = e.target.options[e.target.selectedIndex].text.toLowerCase());
        updateDashboard();
    });

    // Afficher les contrôles du graphique de tendance par défaut et activer les écouteurs
    const trendControls = document.getElementById('trend-chart-controls');
    if (trendControls) {
        trendControls.style.display = 'flex';  // S'assurer qu'ils sont visibles
        
        // Écouteurs pour les contrôles
        document.querySelectorAll('#trend-chart-controls input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', function(e) {
                if (appState.charts.trendChart) {
                    updateTrendChartVisibility();
                }
            });
        });
    }
    
    // Ajouter des écouteurs pour les liens de navigation dans la sidebar
    document.querySelectorAll('.sidebar-nav li a').forEach(link => {
        link.addEventListener('click', function(e) {
            const sectionId = this.getAttribute('href').substring(1);
            activateSection(sectionId);
        });
    });
    
    // Écouter les changements de hash dans l'URL
    window.addEventListener('hashchange', handleHashChange);
    
    // Écouter les clics sur le bouton pour réduire/agrandir la sidebar
    document.getElementById('toggle-sidebar').addEventListener('click', function() {
        document.querySelector('.sidebar').classList.toggle('expanded');
    });
}

// Gestionnaire pour les changements de hash dans l'URL
function handleHashChange() {
    const hash = window.location.hash;
    if (hash) {
        // Enlever le # du début du hash
        const sectionId = hash.substring(1);
        activateSection(sectionId);
    } else {
        // Si pas de hash, activer la section par défaut (overview)
        activateSection('overview');
    }
}

// Fonction pour activer une section spécifique
function activateSection(sectionId) {
    // Désactiver toutes les sections
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Désactiver tous les éléments de navigation
    document.querySelectorAll('.sidebar-nav li').forEach(item => {
        item.classList.remove('active');
    });
    
    // Activer la section spécifiée
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        
        // Activer l'élément de navigation correspondant
        const navItem = document.querySelector(`.sidebar-nav li[data-section="${sectionId}"]`);
        if (navItem) {
            navItem.classList.add('active');
        }
    }
}

// Récupération des données depuis l'API
async function fetchData() {
    try {
        const response = await fetch('/api/trip_volume');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Fetched data:", data);
        
        // Stocker les données brutes
        appState.rawData = data;
        
    } catch (error) {
        console.error("Failed to fetch trip data:", error);
        showError("Erreur lors de la récupération des données");
    }
}

// Met à jour l'ensemble du dashboard
function updateDashboard() {
    // Filtrer les données selon l'année sélectionnée
    filterData();
    
    // Mettre à jour les statistiques
    updateStatCards();
    
    // Créer ou mettre à jour les graphiques
    createOrUpdateCharts();
    
    // Mettre à jour la table de données
    createOrUpdateDataTable();
    
    // Mettre à jour les graphiques de qualité des données
    createOrUpdateQualityCharts();
}

// Filtre les données selon les sélecteurs
function filterData() {
    if (!appState.rawData.length) return;
    
    // Filtrer par années sélectionnées
    if (appState.selectedYears.length > 0) {
        // Convertir les années en nombres pour la comparaison
        const years = appState.selectedYears.map(year => parseInt(year));
        appState.filteredData = appState.rawData.filter(item => {
            const date = new Date(item.date);
            return years.includes(date.getFullYear());
        });
    } else {
        // Si aucune année n'est sélectionnée (ne devrait pas arriver), montrer toutes les données
        appState.filteredData = [...appState.rawData];
    }
    
    // Trier par date
    appState.filteredData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Si aucune donnée disponible
    if (appState.filteredData.length === 0) {
        showError(`Aucune donnée disponible pour les années sélectionnées (${appState.selectedYears.join(', ')})`);
    }
}

// Mise à jour des cartes de statistiques (avec Tendance)
async function updateStatCards() {
    // D'abord, récupérer les données de tendance
    let trendData = null;
    try {
        const response = await fetch('/api/kpi_trends');
        if (response.ok) {
            trendData = await response.json();
        } else {
            console.warn('Failed to fetch KPI trends:', response.status);
        }
    } catch (error) {
        console.error("Error fetching KPI trends:", error);
    }
    
    // Fonction helper pour formater la tendance
    const formatTrend = (trendValue) => {
        if (!trendValue || trendValue.trend === null || trendValue.trend === undefined) return '';
        const trend = trendValue.trend;
        const absTrend = Math.abs(trend).toFixed(1) + '%';
        const className = trend > 0 ? 'trend-up' : (trend < 0 ? 'trend-down' : '');
        return `<span class="${className}">${absTrend}</span>`;
    };

    // Fonction helper pour mettre à jour une carte KPI
    const updateCard = (cardId, valueKey, formatterFn = formatNumber) => {
        const valueElement = document.querySelector(`#${cardId} .value`);
        const trendElement = document.querySelector(`#${cardId} .trend-indicator`);
        
        // Créer une valeur par défaut si trendData est null ou undefined
        const defaultValue = { current: 0, previous: 0, trend: 0 };
        const valueData = trendData ? (trendData[valueKey] || defaultValue) : defaultValue;
        
        if (valueElement) {
            valueElement.textContent = formatterFn(valueData.current);
        }
        if (trendElement) {
            trendElement.innerHTML = formatTrend(valueData);
        }
    };

    // Mettre à jour les cartes avec les données de tendance ou des valeurs par défaut
    updateCard('total-trips', 'total_trips');
    updateCard('avg-trips', 'avg_trips_per_period');
    updateCard('max-trips', 'max_trips_per_period');
    updateCard('avg-amount', 'avg_amount_overall', value => `€${value.toFixed(2)}`);
}

// Création ou mise à jour des graphiques
function createOrUpdateCharts() {
    // Ces graphiques/tableaux chargent leurs propres données, donc on les appelle toujours.
    createOrUpdatePaymentChart();
    createOrUpdateHourlyHeatmap();
    createOrUpdatePassengerChart();
    createOrUpdateFinancialBreakdownChart();
    createOrUpdateVendorChart();
    // createOrUpdateMap(); // RETIRÉ
    createOrUpdateBoroughFlowTable(); // S'assure que cette fonction est appelée

    // Ces graphiques dépendent de appState.filteredData (données de volume de trajet)
    if (!appState.filteredData.length) {
        // Gérer l'absence de données pour TrendChart (Performance Temporelle)
        if (appState.charts.trendChart) {
            appState.charts.trendChart.destroy();
            appState.charts.trendChart = null;
        }
        const trendCanvas = document.getElementById('tripVolumeChart');
        if (trendCanvas) {
            const ctx = trendCanvas.getContext('2d');
            ctx.clearRect(0, 0, trendCanvas.width, trendCanvas.height);
            // Afficher un message si le conteneur est vide ou ne contient pas déjà un message
            if (trendCanvas.innerHTML.trim() === '' || !trendCanvas.querySelector('.no-data-message')) {
                 trendCanvas.innerHTML = '<p class="no-data-message">Aucune donnée de performance temporelle disponible.</p>';
            }
        }

        // Gérer l'absence de données pour MonthlyDistribution
        if (appState.charts.monthlyChart) {
            appState.charts.monthlyChart.destroy();
            appState.charts.monthlyChart = null;
        }
        const monthlyCanvas = document.getElementById('monthlyDistribution');
        if (monthlyCanvas) {
            const ctx = monthlyCanvas.getContext('2d');
            ctx.clearRect(0, 0, monthlyCanvas.width, monthlyCanvas.height);
            if (monthlyCanvas.innerHTML.trim() === '' || !monthlyCanvas.querySelector('.no-data-message')) {
                monthlyCanvas.innerHTML = '<p class="no-data-message">Aucune donnée de distribution mensuelle disponible.</p>';
            }
        }
    } else {
        // Les données sont disponibles, donc on met à jour les graphiques dépendants

        // Nettoyer les messages "no data" s'ils existent et que les données sont maintenant là
        const trendCanvas = document.getElementById('tripVolumeChart');
        const trendMessageEl = trendCanvas?.querySelector('.no-data-message');
        if (trendMessageEl) trendMessageEl.remove();

        const monthlyCanvas = document.getElementById('monthlyDistribution');
        const monthlyMessageEl = monthlyCanvas?.querySelector('.no-data-message');
        if (monthlyMessageEl) monthlyMessageEl.remove();
        
        const aggregatedData = aggregateData(appState.filteredData, appState.aggregation);
        createOrUpdateTrendChart(aggregatedData);
        createOrUpdateMonthlyDistribution(appState.filteredData);
    }

    // Ajouter l'appel aux nouveaux graphiques de qualité
    createOrUpdateQualityCharts();
}

// Fonction pour vider les graphiques (ET réintégré la carte)
function clearCharts() {
    Object.values(appState.charts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') chart.destroy();
    });
    appState.charts = {};
    // Ajouter les nouveaux IDs à la liste
    ['tripVolumeChart', 'monthlyDistribution', 'paymentTypeChart', 'hourlyHeatmap', 
     'passengerChart', 'financialBreakdownChart', 'vendorChart',
     'qualityRadarChart', 'fieldCompletenessChart'].forEach(id => { 
        const container = document.getElementById(id);
        if (container) {
            if (container.tagName === 'CANVAS') {
                 const ctx = container.getContext('2d');
                 ctx.clearRect(0, 0, container.width, container.height);
            } else {
                 container.innerHTML = '<p class=\"no-data-message\">Chargement...</p>'; 
            }
        }
    });
    
    // Vider les tables
    const boroughTableContainer = document.getElementById('borough-flow-table');
    if (boroughTableContainer) boroughTableContainer.innerHTML = '<p class="no-data-message">Chargement...</p>';
    const qualityAlertsContainer = document.getElementById('qualityAlertsTable');
    if (qualityAlertsContainer) qualityAlertsContainer.innerHTML = '<p class="no-data-message">Chargement...</p>';
    
    if (appState.dataTable) {
        appState.dataTable.destroy();
        appState.dataTable = null;
        document.getElementById('data-table').innerHTML = '';
    }
    
    // Nettoyer les tables spécifiques 
    if (appState.charts.qualityAlertsTable) {
        appState.charts.qualityAlertsTable.destroy();
        appState.charts.qualityAlertsTable = null;
    }
    
    if (appState.charts.boroughFlowTable) {
        appState.charts.boroughFlowTable.destroy();
        appState.charts.boroughFlowTable = null;
    }
    
    // Garder la partie des commentaires pour la carte (retirée)
}

// NOUVELLE FONCTION: Met à jour la visibilité des datasets et axes du graphique de tendance
function updateTrendChartVisibility() {
    const chart = appState.charts.trendChart;
    if (!chart) return;

    const controls = document.querySelectorAll('#trend-chart-controls input[type="checkbox"]');
    const visibility = {};
    controls.forEach(cb => {
        visibility[cb.dataset.metric] = cb.checked;
    });

    let secondaryAxisUsed = false;
    chart.data.datasets.forEach(dataset => {
        let hidden = false;
        switch (dataset.label) {
            case 'Pourboire Moyen (€)':
                hidden = !visibility.avg_tip_amount;
                if (!hidden) secondaryAxisUsed = true;
                break;
            case 'Distance Moyenne (km)':
                hidden = !visibility.avg_trip_distance;
                if (!hidden) secondaryAxisUsed = true;
                break;
            case 'Durée Moyenne (min)':
                hidden = !visibility.avg_trip_duration_seconds;
                if (!hidden) secondaryAxisUsed = true;
                break;
            // Laisser les autres visibles (Nb Trajets, Montant Total Moyen)
        }
        dataset.hidden = hidden;
    });

    // Afficher l'axe secondaire (yAmount) seulement si une des métriques secondaires est cochée
    chart.options.scales.yAmount.display = secondaryAxisUsed;
    
    chart.update();
}

// Graphique de tendance temporelle (Simplifié et Stylisé)
function createOrUpdateTrendChart(data) {
    const canvas = document.getElementById('tripVolumeChart');
    // Vider le message "Aucune donnée" s'il existe
    if (canvas.innerHTML.includes('no-data-message')) canvas.innerHTML = '';
    const ctx = canvas.getContext('2d');
    
    // Palette de couleurs inspirée du design moderne
    const colors = {
        primary: '#03a9f4', // Bleu primaire
        secondary: '#ff9800' // Orange d'accentuation
    };
    
    // Par défaut: Nombre de trajets et Montant Moyen
    const datasets = [
        {
            label: 'Nombre de Trajets',
            data: data.map(d => ({ x: d.date, y: d.trip_count })),
            borderColor: colors.primary,
            backgroundColor: 'rgba(3, 169, 244, 0.1)',
            yAxisID: 'yCount',
            fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 1, pointHoverRadius: 4
        },
        {
            label: 'Montant Total Moyen (€)',
            data: data.map(d => ({ x: d.date, y: d.avg_total_amount })),
            borderColor: colors.secondary,
            backgroundColor: 'rgba(255, 152, 0, 0.1)',
            yAxisID: 'yAmount',
            fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 1, pointHoverRadius: 4
        }
        // Les autres métriques sont désactivées pour l'instant
    ];
    
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: appState.aggregation,
                    tooltipFormat: 'PP', // Format date simple
                    displayFormats: { 
                        day: 'd MMM', 
                        week: 'd MMM', 
                        month: 'MMM', // Juste le mois pour l'axe X
                        quarter: 'QQQ' 
                    }
                },
                grid: { display: false }, // Pas de grille verticale
                border: { display: false }, // Pas de ligne d'axe X
                ticks: { color: 'rgba(0,0,0,0.6)', padding: 10 }
            },
            yCount: { // Axe Primaire (Gauche) - Nb Trajets
                display: true,
                position: 'left',
                title: { display: false }, // Pas de titre d'axe
                ticks: { 
                    callback: value => formatNumber(value), 
                    color: 'rgba(0,0,0,0.6)', 
                    padding: 10,
                    // Afficher moins de ticks
                    maxTicksLimit: 6 
                },
                grid: { 
                    color: 'rgba(0,0,0,0.05)', // Couleur de grille légère
                    drawBorder: false, // Pas de ligne d'axe Y
                }
            },
            yAmount: { // Axe Secondaire (Droite) - Montant
                display: true, // Affiché par défaut maintenant
                position: 'right',
                title: { display: false }, // Pas de titre d'axe
                ticks: { 
                    callback: value => `€${formatNumber(value)}`, 
                    color: 'rgba(0,0,0,0.6)', 
                    padding: 10,
                    maxTicksLimit: 6
                },
                grid: { drawOnChartArea: false } // Pas de grille pour axe secondaire
            }
        },
        plugins: {
            tooltip: { // Tooltips stylisés
                enabled: true,
                backgroundColor: 'rgba(50, 50, 50, 0.9)', // Fond sombre
                titleColor: '#fff',
                bodyColor: '#eee',
                borderColor: 'rgba(0,0,0,0.1)',
                borderWidth: 1,
                padding: 10,
                displayColors: true, // Afficher les carrés de couleur
                boxPadding: 4,
                callbacks: {
                    title: function(tooltipItems) {
                        const date = new Date(tooltipItems[0].parsed.x);
                        // Adapter le format selon l'agrégation
                        let formatOptions = { month: 'long', year: 'numeric' };
                        if (appState.aggregation === 'day' || appState.aggregation === 'week') {
                            formatOptions = { dateStyle: 'medium' };
                        }
                        return date.toLocaleDateString('fr-FR', formatOptions);
                    },
                    label: function(context) {
                        const datasetLabel = context.dataset.label || '';
                        const value = context.parsed.y;
                        if (value === null) return null;
                        
                        let formattedValue = '';
                        switch(datasetLabel) {
                            case 'Nombre de Trajets': formattedValue = formatNumber(value); break;
                            case 'Montant Total Moyen (€)': formattedValue = `€${value.toFixed(2)}`; break;
                            case 'Pourboire Moyen (€)': formattedValue = `€${value.toFixed(2)}`; break;
                            case 'Distance Moyenne (km)': formattedValue = `${value.toFixed(1)} km`; break;
                            case 'Durée Moyenne (min)': formattedValue = `${Math.round(value)} min`; break;
                            default: formattedValue = value.toLocaleString();
                        }
                        return `${datasetLabel}: ${formattedValue}`;
                    }
                }
            },
            legend: {
                display: true, // Afficher la légende
                position: 'top', // En haut comme dans l'exemple
                align: 'end', // Alignée à droite
                labels: {
                    usePointStyle: true, // Utiliser des cercles
                    boxWidth: 8, 
                    padding: 20,
                    color: 'rgba(0,0,0,0.7)'
                }
            },
            zoom: {
                pan: {
                    enabled: true,
                    mode: 'x'
                },
                zoom: {
                    wheel: {
                        enabled: true
                    },
                    pinch: {
                        enabled: true
                    },
                    mode: 'x'
                }
            }
        }
    };
    
    if (appState.charts.trendChart) {
        appState.charts.trendChart.data.datasets = datasets;
        appState.charts.trendChart.options = options;
        appState.charts.trendChart.update();
    } else {
        appState.charts.trendChart = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: options
        });
    }
}

// Distribution mensuelle
function createOrUpdateMonthlyDistribution(data) {
    const ctx = document.getElementById('monthlyDistribution').getContext('2d');
    
    // Agréger par mois indépendamment de l'année
    const monthlyData = Array(12).fill(0);
    const monthlyCount = Array(12).fill(0);
    
    data.forEach(item => {
        const date = new Date(item.date);
        const month = date.getMonth();
        monthlyData[month] += item.trip_count;
        monthlyCount[month]++;
    });
    
    // Calculer la moyenne par mois si plusieurs années
    const monthlyAvg = monthlyData.map((total, i) => 
        monthlyCount[i] ? Math.round(total / monthlyCount[i]) : 0
    );
    
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    
    // Données pour le graphique
    const chartData = {
        labels: monthNames,
        datasets: [{
            label: 'Moyenne de trajets',
            data: monthlyAvg,
            backgroundColor: 'rgba(75, 192, 192, 0.7)',
            borderWidth: 1
        }]
    };
    
    // Options
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: value => formatNumber(value)
                }
            }
        },
        plugins: {
            tooltip: {
                callbacks: {
                    label: context => `Moyenne: ${context.parsed.y.toLocaleString()}`
                }
            }
        }
    };
    
    // Créer ou mettre à jour
    if (appState.charts.monthlyChart) {
        appState.charts.monthlyChart.data = chartData;
        appState.charts.monthlyChart.options = options;
        appState.charts.monthlyChart.update();
    } else {
        appState.charts.monthlyChart = new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: options
        });
    }
}

// NOUVELLE FONCTION: Graphique d'analyse par type de paiement
async function createOrUpdatePaymentChart() {
    const canvas = document.getElementById('paymentTypeChart');
    if (canvas.innerHTML.includes('no-data-message')) canvas.innerHTML = '';
    const ctx = canvas.getContext('2d');

    try {
        // Fetch data for payment analysis
        const response = await fetch('/api/payment_analysis');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        let paymentData = await response.json();

        if (!paymentData || paymentData.length === 0) {
            showError("Aucune donnée de paiement disponible.");
            ctx.fillText('Aucune donnée de paiement', canvas.width / 2, canvas.height / 2); // Message d'erreur
            return;
        }
        
        // Filtrer les données par années sélectionnées si l'API contient la date
        // Note: cette partie est conditionnelle car elle dépend du format des données renvoyées par l'API
        if (paymentData[0].date) {
            if (appState.selectedYears.length > 0) {
                const years = appState.selectedYears.map(year => parseInt(year));
                paymentData = paymentData.filter(item => {
                    const date = new Date(item.date);
                    return years.includes(date.getFullYear());
                });
            }
            
            // Vérifier qu'il reste des données après filtrage
            if (paymentData.length === 0) {
                showError(`Aucune donnée de paiement disponible pour les années: ${appState.selectedYears.join(', ')}`);
                ctx.fillText('Aucune donnée pour ces années', canvas.width / 2, canvas.height / 2);
                return;
            }
        }

        // Trier par nombre de trajets (déjà fait côté serveur, mais double check)
        paymentData.sort((a, b) => b.trip_count - a.trip_count);

        // Limiter aux N premiers types pour la lisibilité ? (optionnel)
        // const topN = 5;
        // const displayData = paymentData.slice(0, topN);
        const displayData = paymentData; // Afficher tout pour l'instant

        const labels = displayData.map(item => item.payment_type_name);
        const tripCounts = displayData.map(item => item.trip_count);
        const avgTips = displayData.map(item => item.avg_tip_amount);

        const colors = {
            bar: 'rgba(75, 192, 192, 0.6)', // Cyan
            line: 'rgba(255, 159, 64, 1)', // Orange
            barBorder: 'rgba(75, 192, 192, 1)',
            lineBorder: 'rgba(255, 159, 64, 1)'
        };

        const chartData = {
            labels: labels,
            datasets: [
                {
                    label: 'Nombre de Trajets',
                    data: tripCounts,
                    backgroundColor: colors.bar,
                    borderColor: colors.barBorder,
                    borderWidth: 1,
                    type: 'bar',
                    yAxisID: 'yCount',
                    order: 2 // Pour que les barres soient derrière la ligne
                },
                {
                    label: 'Pourboire Moyen (€)',
                    data: avgTips,
                    borderColor: colors.lineBorder,
                    backgroundColor: addAlpha(colors.lineBorder, 0.5), // Point color
                    type: 'line',
                    yAxisID: 'yTip',
                    tension: 0.1,
                    borderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    order: 1
                }
            ]
        };

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: { color: '#666' },
                    grid: { display: false }
                },
                yCount: { // Axe pour le nombre de trajets (gauche)
                    type: 'linear',
                    position: 'left',
                    beginAtZero: true,
                    title: { display: true, text: 'Nb Trajets', color: colors.barBorder },
                    ticks: { callback: value => formatNumber(value), color: colors.barBorder },
                    grid: { color: '#e9ecef' }
                },
                yTip: { // Axe pour le pourboire moyen (droite)
                    type: 'linear',
                    position: 'right',
                    beginAtZero: true,
                    title: { display: true, text: 'Pourboire Moyen (€)', color: colors.lineBorder },
                    ticks: { callback: value => `€${value.toFixed(2)}`, color: colors.lineBorder },
                    grid: { drawOnChartArea: false } // Pas de grille pour cet axe
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.dataset.type === 'bar') {
                                label += formatNumber(context.parsed.y);
                            } else {
                                label += `€${context.parsed.y.toFixed(2)}`;
                            }
                            return label;
                        }
                    }
                },
                legend: {
                    position: 'top', align: 'end',
                    labels: { usePointStyle: true, boxWidth: 8, padding: 20, color: '#666' }
                }
            }
        };

        // Créer ou mettre à jour le graphique
        if (appState.charts.paymentChart) {
            appState.charts.paymentChart.data = chartData;
            appState.charts.paymentChart.options = options;
            appState.charts.paymentChart.update();
        } else {
            appState.charts.paymentChart = new Chart(ctx, {
                // Type défini dans les datasets
                data: chartData,
                options: options
            });
        }

    } catch (error) {
        console.error("Failed to render payment chart:", error);
        showError("Erreur lors de l'affichage de l'analyse des paiements.");
        ctx.fillText('Erreur chargement graphique', canvas.width / 2, canvas.height / 2);
    }
}

// NOUVELLE FONCTION: Heatmap Heure/Jour
async function createOrUpdateHourlyHeatmap() {
    const canvas = document.getElementById('hourlyHeatmap');
    if (canvas.innerHTML.includes('no-data-message')) canvas.innerHTML = '';
    const ctx = canvas.getContext('2d');

    try {
        const response = await fetch('/api/hourly_activity');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        let hourlyData = await response.json();

        if (!hourlyData || hourlyData.length === 0) {
            showError("Aucune donnée d'activité horaire disponible.");
            ctx.fillText('Aucune donnée horaire', canvas.width / 2, canvas.height / 2);
            return;
        }
        
        // Filtrer par année si la propriété year est disponible
        if (hourlyData[0].year) {
            if (appState.selectedYears.length > 0) {
                const years = appState.selectedYears.map(year => parseInt(year));
                hourlyData = hourlyData.filter(item => years.includes(item.year));
            }
            
            // Vérifier qu'il reste des données après filtrage
            if (hourlyData.length === 0) {
                showError(`Aucune donnée d'activité horaire disponible pour les années: ${appState.selectedYears.join(', ')}`);
                ctx.fillText('Aucune donnée pour ces années', canvas.width / 2, canvas.height / 2);
                return;
            }
        }

        // Préparer les données pour le type matrix
        const heatmapData = hourlyData.map(item => ({
            // Axe X: Heure (0-23)
            x: item.hour_of_day,
            // Axe Y: Jour de la semaine (0=Lundi, 6=Dimanche)
            // Note: On décale car l'API retourne ISO DOW (1-7)
            y: item.day_of_week - 1, 
            v: item.trip_count // Valeur (nombre de trajets)
        }));

        const maxValue = Math.max(...heatmapData.map(d => d.v));
        const colorScale = (value) => {
            const alpha = value ? Math.min(0.1 + (value / maxValue * 0.9), 1) : 0;
            return `rgba(74, 144, 226, ${alpha})`; // Bleu primaire
        };

        const chartData = {
            datasets: [{
                label: 'Activité Horaire',
                data: heatmapData,
                backgroundColor: context => colorScale(context.dataset.data[context.dataIndex].v),
                borderColor: 'rgba(200, 200, 200, 0.2)',
                borderWidth: 1,
                // Ajuster la taille des cellules
                width: ({ chart }) => (chart.chartArea || {}).width / 24 - 1,
                height: ({ chart }) => (chart.chartArea || {}).height / 7 - 1
            }]
        };

        const dayLabels = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { // Jours de la semaine
                    type: 'linear',
                    offset: true,
                    min: -0.5,
                    max: 6.5,
                    ticks: {
                        stepSize: 1,
                        callback: value => (value >= 0 && value < 7) ? dayLabels[value] : '',
                        color: '#666'
                    },
                    grid: { display: false, drawBorder: false },
                    reverse: true // Afficher Lundi en haut
                },
                x: { // Heures de la journée
                    type: 'linear',
                    offset: true,
                    min: -0.5,
                    max: 23.5,
                    ticks: {
                        stepSize: 2, // Afficher toutes les 2 heures
                        callback: value => (value >= 0 && value <= 23) ? `${String(value).padStart(2, '0')}h` : '',
                        color: '#666'
                    },
                    grid: { display: false, drawBorder: false },
                    position: 'top' // Afficher les heures en haut
                }
            },
            plugins: {
                legend: { display: false }, // Pas de légende utile ici
                tooltip: {
                    displayColors: false,
                    callbacks: {
                        title: () => '', // Pas de titre
                        label: function(context) {
                            const data = context.dataset.data[context.dataIndex];
                            const day = dayLabels[data.y];
                            const hour = `${String(data.x).padStart(2, '0')}h`;
                            const value = formatNumber(data.v);
                            return `${day} ${hour}: ${value} trajets`;
                        }
                    }
                }
            }
        };

        // Créer ou mettre à jour
        if (appState.charts.hourlyHeatmap) {
            appState.charts.hourlyHeatmap.data = chartData;
            appState.charts.hourlyHeatmap.options = options;
            appState.charts.hourlyHeatmap.update();
        } else {
            appState.charts.hourlyHeatmap = new Chart(ctx, {
                type: 'matrix',
                data: chartData,
                options: options
            });
        }

    } catch (error) {
        console.error("Failed to render hourly heatmap:", error);
        showError("Erreur lors de l'affichage de la heatmap horaire.");
        ctx.fillText('Erreur chargement graphique', canvas.width / 2, canvas.height / 2);
    }
}

// Créer ou mettre à jour la table de données
function createOrUpdateDataTable() {
    if (!appState.filteredData.length) return;
    
    // Agréger les données selon la période sélectionnée
    const tableData = aggregateData(appState.filteredData, appState.aggregation);
    
    // Configuration des colonnes
    const columns = [
        {title: "Date", field: "date", formatter: "datetime", formatterParams: {
            outputFormat: getDateFormat(appState.aggregation),
            invalidPlaceholder: "(date invalide)"
        }},
        {title: "Nombre de Trajets", field: "trip_count", formatter: "money", formatterParams: {
            thousand: " ",
            symbol: "",
            precision: 0
        }}
    ];
    
    // Si la table existe déjà, mettre à jour les données
    if (appState.dataTable) {
        appState.dataTable.setData(tableData);
    } else {
        // Créer une nouvelle table
        appState.dataTable = new Tabulator("#data-table", {
            data: tableData,
            columns: columns,
            layout: "fitColumns",
            pagination: "local",
            paginationSize: 10,
            paginationSizeSelector: [5, 10, 25, 50],
            movableColumns: true,
            initialSort: [
                {column: "date", dir: "desc"}
            ]
        });
    }
}

// Fonctions utilitaires

// Formatage des nombres
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
}

// Formatage des dates
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('fr-FR', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
    }).format(date);
}

// Retourne le format de date selon l'agrégation
function getDateFormat(aggregation) {
    switch(aggregation) {
        case 'day': return "DD/MM/YYYY";
        case 'week': return "'Sem' W, MMM YYYY";
        case 'month': return "MMMM YYYY";
        case 'quarter': return "['T']Q YYYY";
        default: return "DD/MM/YYYY";
    }
}

// Agrégation des données selon la période
function aggregateData(data, period) {
    if (period === 'day') return data; 
    
    const aggregated = new Map();
    
    data.forEach(item => {
        const date = new Date(item.date);
        let key;
        
        switch(period) {
            case 'week':
                // Calculer le début de la semaine (lundi)
                const dayOfWeek = date.getDay() || 7; // 0 (dimanche) devient 7
                const diff = dayOfWeek - 1; // Différence avec lundi
                const monday = new Date(date);
                monday.setDate(date.getDate() - diff);
                key = monday.toISOString().split('T')[0];
                break;
            case 'month':
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
                break;
            case 'quarter':
                const quarter = Math.floor(date.getMonth() / 3);
                key = `${date.getFullYear()}-${String(quarter * 3 + 1).padStart(2, '0')}-01`;
                break;
            default:
                key = item.date;
        }
        
        if (!aggregated.has(key)) {
            aggregated.set(key, { 
                date: key, 
                trip_count: 0, 
                total_amount_sum: 0, // Sommer pour calculer la moyenne pondérée
                tip_amount_sum: 0,
                trip_distance_sum: 0,
                trip_duration_sum: 0,
                total_records: 0 // Compter le nombre de jours/enregistrements agrégés
            });
        }
        
        const current = aggregated.get(key);
        current.trip_count += item.trip_count;
        current.total_amount_sum += item.avg_total_amount * item.trip_count; // Somme pondérée
        current.tip_amount_sum += item.avg_tip_amount * item.trip_count;
        current.trip_distance_sum += item.avg_trip_distance * item.trip_count;
        current.trip_duration_sum += item.avg_trip_duration_seconds * item.trip_count;
        current.total_records += 1; // Incrémente le nombre d'enregistrements (jours) agrégés

    });
    
    // Calculer les moyennes finales
    const finalAggregated = Array.from(aggregated.values()).map(item => {
        const count = item.trip_count || 1; // Éviter division par zéro
        return {
            date: item.date,
            trip_count: item.trip_count,
            avg_total_amount: item.total_amount_sum / count,
            avg_tip_amount: item.tip_amount_sum / count,
            avg_trip_distance: item.trip_distance_sum / count,
            avg_trip_duration_seconds: item.trip_duration_sum / count
        };
    });
    
    return finalAggregated.sort((a, b) => a.date.localeCompare(b.date));
}

// Affiche un message d'erreur
function showError(message) {
    console.error(message);
    // On pourrait ajouter un système de notification ici
}

// Helper pour ajouter de la transparence à une couleur RGB
function addAlpha(rgbColor, alpha) {
    return rgbColor.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
}

// Initialiser le dashboard au chargement
document.addEventListener('DOMContentLoaded', initDashboard);

// --- Nouvelles Fonctions Graphiques --- 

// Graphique Répartition Passagers
async function createOrUpdatePassengerChart() {
    const canvasId = 'passengerChart';
    const container = document.getElementById(canvasId);
    if (container.innerHTML.includes('no-data-message')) container.innerHTML = '';
    const ctx = container.getContext('2d');

    try {
        const response = await fetch('/api/passenger_analysis');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        let data = await response.json();

        if (!data || data.length === 0) throw new Error("No passenger data");
        
        // Filtrer par année si les données contiennent des dates ou années
        if (data[0].date) {
            if (appState.selectedYears.length > 0) {
                const years = appState.selectedYears.map(year => parseInt(year));
                data = data.filter(item => {
                    const date = new Date(item.date);
                    return years.includes(date.getFullYear());
                });
            }
            
            // Vérifier qu'il reste des données après filtrage
            if (data.length === 0) {
                throw new Error(`Aucune donnée passager disponible pour les années: ${appState.selectedYears.join(', ')}`);
            }
        } else if (data[0].year) {
            if (appState.selectedYears.length > 0) {
                const years = appState.selectedYears.map(year => parseInt(year));
                data = data.filter(item => years.includes(item.year));
            }
            
            // Vérifier qu'il reste des données après filtrage
            if (data.length === 0) {
                throw new Error(`Aucune donnée passager disponible pour les années: ${appState.selectedYears.join(', ')}`);
            }
        }

        // Traiter les nulls et regrouper si > N passagers ?
        const labels = data.map(d => d.passenger_count !== null ? `${d.passenger_count}` : 'Inconnu');
        const counts = data.map(d => d.trip_count);

        const chartData = {
            labels: labels,
            datasets: [{
                label: 'Nombre de Trajets',
                data: counts,
                backgroundColor: 'rgba(144, 19, 254, 0.6)', // Violet
                borderColor: 'rgba(144, 19, 254, 1)',
                borderWidth: 1
            }]
        };

        const options = {
            indexAxis: 'y', // Barres horizontales pour lisibilité
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { beginAtZero: true, ticks: { callback: formatNumber } },
                y: { ticks: { autoSkip: false } }
            },
            plugins: { legend: { display: false } }
        };

        if (appState.charts.passengerChart) {
            appState.charts.passengerChart.data = chartData;
            appState.charts.passengerChart.options = options;
            appState.charts.passengerChart.update();
        } else {
            appState.charts.passengerChart = new Chart(ctx, { type: 'bar', data: chartData, options: options });
        }
    } catch (error) {
        console.error("Failed to render passenger chart:", error);
        showError("Erreur chargement graphique Passagers.");
        ctx.fillText('Erreur', container.width / 2, container.height / 2);
    }
}

// Graphique Décomposition Financière
async function createOrUpdateFinancialBreakdownChart() {
    const canvasId = 'financialBreakdownChart';
    const container = document.getElementById(canvasId);
    if (container.innerHTML.includes('no-data-message')) container.innerHTML = '';
    const ctx = container.getContext('2d');

    try {
        const response = await fetch('/api/financial_breakdown');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        let data = await response.json();

        if (!data || data.length === 0) throw new Error("No financial data");

        // Filtrer les données selon les années sélectionnées
        if (appState.selectedYears.length > 0) {
            const years = appState.selectedYears.map(year => parseInt(year));
            data = data.filter(item => {
                const date = new Date(item.date);
                return years.includes(date.getFullYear());
            });
        }

        // Vérifier qu'il reste des données après filtrage
        if (data.length === 0) {
            throw new Error(`Aucune donnée financière disponible pour les années: ${appState.selectedYears.join(', ')}`);
        }

        // Trier les données par date
        data.sort((a, b) => new Date(a.date) - new Date(b.date));

        const labels = data.map(d => d.date);
        const financialColors = [
            'rgba(75, 192, 192, 0.7)', // Fare
            'rgba(54, 162, 235, 0.7)', // Tip
            'rgba(255, 159, 64, 0.7)', // Tolls
            'rgba(255, 99, 132, 0.7)', // Tax
            'rgba(153, 102, 255, 0.7)', // Surcharge
            'rgba(201, 203, 207, 0.7)' // Extra
        ];
        
        const datasets = [
            { label: 'Course', data: data.map(d => d.avg_fare_amount), backgroundColor: financialColors[0] },
            { label: 'Pourboire', data: data.map(d => d.avg_tip_amount), backgroundColor: financialColors[1] },
            { label: 'Péages', data: data.map(d => d.avg_tolls_amount), backgroundColor: financialColors[2] },
            { label: 'Taxe MTA', data: data.map(d => d.avg_mta_tax), backgroundColor: financialColors[3] },
            { label: 'Surcharge Amél.', data: data.map(d => d.avg_improvement_surcharge), backgroundColor: financialColors[4] },
            { label: 'Extras', data: data.map(d => d.avg_extra), backgroundColor: financialColors[5] }
        ];

        const chartData = { labels: labels, datasets: datasets };

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { type: 'time', time: { unit: 'month' }, stacked: true },
                y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Montant Moyen (€)' }, ticks: { callback: v => `€${v.toFixed(0)}` } }
            },
            plugins: {
                tooltip: { mode: 'index', callbacks: { label: c => `${c.dataset.label}: €${c.parsed.y.toFixed(2)}` } },
                legend: { position: 'bottom' }
            }
        };

        if (appState.charts.financialChart) {
            appState.charts.financialChart.data = chartData;
            appState.charts.financialChart.options = options;
            appState.charts.financialChart.update();
        } else {
            appState.charts.financialChart = new Chart(ctx, { type: 'bar', data: chartData, options: options });
        }
    } catch (error) {
        console.error("Failed to render financial breakdown chart:", error);
        showError("Erreur chargement graphique Finances.");
        ctx.fillText('Erreur', container.width / 2, container.height / 2);
    }
}

// Graphique Analyse Vendeur (Implémentation)
async function createOrUpdateVendorChart() {
    const canvasId = 'vendorChart';
    const container = document.getElementById(canvasId);
    if (!container) return; // Safety check
    if (container.innerHTML.includes('no-data-message')) container.innerHTML = ''; // Clear loading message
    const ctx = container.getContext('2d');

    try {
        const response = await fetch('/api/vendor_analysis');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        let data = await response.json();

        if (!data || data.length === 0) throw new Error("No vendor data");
        
        // Filtrer les données par années sélectionnées si l'API contient la date
        if (data[0].date) {
            if (appState.selectedYears.length > 0) {
                const years = appState.selectedYears.map(year => parseInt(year));
                data = data.filter(item => {
                    const date = new Date(item.date);
                    return years.includes(date.getFullYear());
                });
            }
            
            // Vérifier qu'il reste des données après filtrage
            if (data.length === 0) {
                throw new Error(`Aucune donnée de vendeur disponible pour les années: ${appState.selectedYears.join(', ')}`);
            }
        }

        // Data is already sorted by trip_count DESC from API
        const labels = data.map(d => d.vendor_name || 'Inconnu');
        const tripCounts = data.map(d => d.trip_count);
        const avgAmounts = data.map(d => d.avg_total_amount);
        // const avgDistances = data.map(d => d.avg_trip_distance); // Pourrait être ajouté plus tard

        const colors = {
            bar: 'rgba(255, 159, 64, 0.6)', // Orange
            line: 'rgba(54, 162, 235, 1)',  // Bleu
            barBorder: 'rgba(255, 159, 64, 1)',
            lineBorder: 'rgba(54, 162, 235, 1)'
        };

        const chartData = {
            labels: labels,
            datasets: [
                {
                    label: 'Nombre de Trajets',
                    data: tripCounts,
                    backgroundColor: colors.bar,
                    borderColor: colors.barBorder,
                    borderWidth: 1,
                    type: 'bar',
                    yAxisID: 'yCount',
                    order: 2
                },
                {
                    label: 'Montant Moyen (€)',
                    data: avgAmounts,
                    borderColor: colors.lineBorder,
                    backgroundColor: addAlpha(colors.lineBorder, 0.5),
                    type: 'line',
                    yAxisID: 'yAmount',
                    tension: 0.1,
                    borderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    order: 1
                }
            ]
        };

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: '#666' }, grid: { display: false } },
                yCount: {
                    type: 'linear',
                    position: 'left',
                    beginAtZero: true,
                    title: { display: true, text: 'Nb Trajets', color: colors.barBorder },
                    ticks: { callback: formatNumber, color: colors.barBorder },
                    grid: { color: '#e9ecef' }
                },
                yAmount: {
                    type: 'linear',
                    position: 'right',
                    beginAtZero: true,
                    title: { display: true, text: 'Montant Moyen (€)', color: colors.lineBorder },
                    ticks: { callback: value => `€${value.toFixed(2)}`, color: colors.lineBorder },
                    grid: { drawOnChartArea: false }
                }
            },
            plugins: {
                tooltip: { 
                    mode: 'index', 
                    intersect: false, 
                    callbacks: { /* Similaire à payment chart */ }
                },
                legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8, padding: 20, color: '#666' } }
            }
        };

        if (appState.charts.vendorChart) {
            appState.charts.vendorChart.data = chartData;
            appState.charts.vendorChart.options = options;
            appState.charts.vendorChart.update();
        } else {
            appState.charts.vendorChart = new Chart(ctx, { data: chartData, options: options });
        }
    } catch (error) {
        console.error("Failed to render vendor chart:", error);
        showError("Erreur chargement graphique Vendeur.");
        if (ctx) ctx.fillText('Erreur chargement', container.width / 2, container.height / 2);
    }
}

// MODIFIÉ: Fonction pour créer/mettre à jour le tableau des flux entre arrondissements
async function createOrUpdateBoroughFlowTable() {
    const tableId = 'borough-flow-table';
    const container = document.getElementById(tableId);
    if (!container) {
        console.error(`Table container #${tableId} not found.`);
        return;
    }

    const flowData = await fetchBoroughFlowData();

    if (!flowData || flowData.length === 0) {
        container.innerHTML = '<p class="no-data-message">Aucune donnée de flux disponible.</p>';
        if (appState.charts.boroughFlowTable) {
            appState.charts.boroughFlowTable.destroy();
            appState.charts.boroughFlowTable = null;
        }
        return;
    }
    container.innerHTML = ''; // Vider le message de chargement/erreur

    const columns = [
        { title: "Départ", field: "pickup_borough", width: 150, headerFilter: "input" },
        { title: "Arrivée", field: "dropoff_borough", width: 150, headerFilter: "input" },
        { title: "Nb. Trajets", field: "trip_count", hozAlign: "right", sorter: "number", width: 130, formatter: "money", formatterParams: { precision: 0, thousand: " ", symbol: "" } },
        { title: "Tarif Moyen", field: "avg_fare_amount", hozAlign: "right", sorter: "number", width: 130, formatter: "money", formatterParams: { precision: 2, thousand: " ", symbol: "€" } }
    ];

    if (appState.charts.boroughFlowTable) {
        appState.charts.boroughFlowTable.setData(flowData);
    } else {
        appState.charts.boroughFlowTable = new Tabulator(`#${tableId}`, {
            data: flowData,
            columns: columns,
            layout: "fitColumns",
            height: "400px", // Hauteur fixe pour le tableau
            initialSort: [
                { column: "trip_count", dir: "desc" }
            ],
            pagination: "local",
            paginationSize: 15,
            paginationSizeSelector: [10, 15, 25, 50, 100],
        });
    }
}

async function fetchBoroughFlowData() {
    try {
        const response = await fetch('/api/borough_flows');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        let data = await response.json();
        console.log("Fetched Borough Flow data:", data);
        
        // Filtrer les données selon les années sélectionnées si possible
        if (data.length > 0 && data[0].date) {
            if (appState.selectedYears.length > 0) {
                const years = appState.selectedYears.map(year => parseInt(year));
                data = data.filter(item => {
                    const date = new Date(item.date);
                    return years.includes(date.getFullYear());
                });
            }
            
            // Log si aucune donnée après filtrage
            if (data.length === 0) {
                console.warn(`Aucune donnée de flux disponible pour les années: ${appState.selectedYears.join(', ')}`);
            }
        } else if (data.length > 0 && data[0].year) {
            if (appState.selectedYears.length > 0) {
                const years = appState.selectedYears.map(year => parseInt(year));
                data = data.filter(item => years.includes(item.year));
            }
            
            // Log si aucune donnée après filtrage
            if (data.length === 0) {
                console.warn(`Aucune donnée de flux disponible pour les années: ${appState.selectedYears.join(', ')}`);
            }
        }
        
        return data;
    } catch (error) {
        console.error("Failed to fetch borough flow data:", error);
        showError("Erreur lors de la récupération des flux entre arrondissements.");
        return []; // Retourner un tableau vide en cas d'erreur
    }
}

// Helper function to generate pastel colors (reuse)
function generatePastelColors(count) {
    const colors = [];
    const baseHue = 60; // Start with a yellowish hue for better contrast possibility
    for (let i = 0; i < count; i++) {
        const hue = (baseHue + i * (360 / (count + 1))) % 360; // Distribute hues
        colors.push(`hsla(${hue}, 70%, 75%, 0.7)`); // Slightly lighter/more saturated pastels
    }
    return colors;
}

// NOUVELLE FONCTION: Création/mise à jour des visualisations de qualité des données
function createOrUpdateQualityCharts() {
    createOrUpdateQualityRadarChart();
    createOrUpdateFieldCompletenessChart();
    createOrUpdateQualityAlertsTable();
}

// Fonction pour le graphique radar de qualité
function createOrUpdateQualityRadarChart() {
    const canvas = document.getElementById('qualityRadarChart');
    if (!canvas) return;
    if (canvas.innerHTML.includes('no-data-message')) canvas.innerHTML = '';
    const ctx = canvas.getContext('2d');

    // Données statiques pour le moment - seraient dynamiques avec une API
    const qualityData = {
        labels: [
            'Complétude', 
            'Validité', 
            'Unicité', 
            'Cohérence', 
            'Actualité', 
            'Précision'
        ],
        datasets: [{
            label: 'Score actuel',
            data: [98, 95, 99.8, 92, 85, 90],
            fill: true,
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgb(75, 192, 192)',
            pointBackgroundColor: 'rgb(75, 192, 192)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgb(75, 192, 192)',
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
        }, {
            label: 'Objectif',
            data: [99, 98, 100, 95, 95, 95],
            fill: true,
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgb(54, 162, 235)',
            pointBackgroundColor: 'rgb(54, 162, 235)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgb(54, 162, 235)',
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
        }]
    };

    const options = {
        maintainAspectRatio: false,
        scales: {
            r: {
                angleLines: {
                    display: true,
                    color: 'rgba(0, 0, 0, 0.1)',
                    lineWidth: 1
                },
                suggestedMin: 50,
                suggestedMax: 100,
                pointLabels: {
                    font: {
                        size: 14,
                        weight: 'bold'
                    },
                    color: 'rgba(0, 0, 0, 0.7)',
                    padding: 20  // Augmenter l'espace pour les labels
                },
                ticks: {
                    stepSize: 10,
                    backdropColor: 'transparent',
                    z: 1,
                    font: {
                        size: 11
                    },
                    callback: function(value) {
                        return value + '%';
                    }
                }
            }
        },
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    boxWidth: 12,
                    padding: 20,
                    font: {
                        size: 12
                    }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                titleFont: {
                    size: 13
                },
                bodyFont: {
                    size: 12
                },
                callbacks: {
                    label: function(context) {
                        return context.dataset.label + ': ' + context.raw + '%';
                    }
                }
            }
        }
    };

    if (appState.charts.qualityRadarChart) {
        appState.charts.qualityRadarChart.data = qualityData;
        appState.charts.qualityRadarChart.options = options;
        appState.charts.qualityRadarChart.update();
    } else {
        appState.charts.qualityRadarChart = new Chart(ctx, {
            type: 'radar',
            data: qualityData,
            options: options
        });
    }
}

// Fonction pour le graphique de complétude des champs
function createOrUpdateFieldCompletenessChart() {
    const canvas = document.getElementById('fieldCompletenessChart');
    if (!canvas) return;
    if (canvas.innerHTML.includes('no-data-message')) canvas.innerHTML = '';
    const ctx = canvas.getContext('2d');

    // Données statiques pour le moment - seraient dynamiques avec une API
    const completenessData = {
        labels: ['pickup_location', 'dropoff_location', 'passenger_count', 'trip_distance', 'fare_amount', 'tip_amount', 'total_amount'],
        datasets: [{
            label: 'Pourcentage de complétude',
            data: [99.5, 98.2, 93.7, 99.9, 100, 94.8, 100],
            backgroundColor: 'rgba(153, 102, 255, 0.6)',
            borderColor: 'rgb(153, 102, 255)',
            borderWidth: 1
        }]
    };

    const options = {
        indexAxis: 'y', // Barres horizontales
        maintainAspectRatio: false,
        scales: {
            x: {
                beginAtZero: true,
                max: 100,
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                },
                ticks: {
                    font: {
                        size: 11
                    },
                    padding: 5,
                    callback: function(value) {
                        return value + '%';
                    }
                }
            },
            y: {
                grid: {
                    display: false
                },
                ticks: {
                    font: {
                        size: 12,
                        weight: 'bold'
                    },
                    color: 'rgba(0, 0, 0, 0.7)',
                    padding: 10,
                    crossAlign: 'far'  // Aligner les labels à l'extérieur
                }
            }
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                titleFont: {
                    size: 13
                },
                bodyFont: {
                    size: 12
                },
                callbacks: {
                    label: function(context) {
                        return context.raw + '% complet';
                    }
                }
            }
        },
        barThickness: 24,  // Augmenter l'épaisseur des barres
        maxBarThickness: 30  // Limite maximum d'épaisseur
    };

    if (appState.charts.fieldCompletenessChart) {
        appState.charts.fieldCompletenessChart.data = completenessData;
        appState.charts.fieldCompletenessChart.options = options;
        appState.charts.fieldCompletenessChart.update();
    } else {
        appState.charts.fieldCompletenessChart = new Chart(ctx, {
            type: 'bar',
            data: completenessData,
            options: options
        });
    }
}

// Fonction pour le tableau des alertes de qualité
function createOrUpdateQualityAlertsTable() {
    const tableId = 'qualityAlertsTable';
    const container = document.getElementById(tableId);
    if (!container) return;

    // Données statiques pour le moment - seraient dynamiques avec une API
    const alertsData = [
        { id: 1, severity: 'high', type: 'missing_values', field: 'passenger_count', message: '345 trajets sans comptage passagers', date: '2024-05-10' },
        { id: 2, severity: 'medium', type: 'format_error', field: 'pickup_datetime', message: '123 dates au format incorrect', date: '2024-05-09' },
        { id: 3, severity: 'low', type: 'outlier', field: 'fare_amount', message: '12 trajets avec tarifs anormalement élevés', date: '2024-05-08' },
        { id: 4, severity: 'medium', type: 'duplicate', field: 'trip_id', message: '8 identifiants de trajet dupliqués', date: '2024-05-06' }
    ];

    // Formatage pour les alertes (couleurs, icônes, etc.)
    const severityFormatter = function(cell) {
        const severity = cell.getValue();
        let color, icon, text;
        
        switch(severity) {
            case 'high':
                color = '#ff4d4d';
                icon = 'fas fa-exclamation-circle';
                text = 'Haute';
                break;
            case 'medium':
                color = '#ffa64d';
                icon = 'fas fa-exclamation-triangle';
                text = 'Moyenne';
                break;
            case 'low':
                color = '#66cc66';
                icon = 'fas fa-info-circle';
                text = 'Basse';
                break;
            default:
                color = '#999999';
                icon = 'fas fa-question-circle';
                text = 'Inconnue';
        }
        
        return `<span style="color:${color}"><i class="${icon}"></i> ${text}</span>`;
    };

    const columns = [
        { title: "Sévérité", field: "severity", formatter: severityFormatter, width: 110 },
        { title: "Problème", field: "message", width: 300 },
        { title: "Champ", field: "field", width: 150 },
        { title: "Date", field: "date", width: 110, formatter: "datetime", formatterParams: {
            outputFormat: "DD/MM/YYYY",
            invalidPlaceholder: "(date invalide)"
        }}
    ];

    if (appState.charts.qualityAlertsTable) {
        appState.charts.qualityAlertsTable.setData(alertsData);
    } else {
        appState.charts.qualityAlertsTable = new Tabulator(`#${tableId}`, {
            data: alertsData,
            columns: columns,
            layout: "fitColumns",
            height: "300px",
            initialSort: [
                { column: "severity", dir: "asc" },
                { column: "date", dir: "desc" }
            ],
            pagination: "local",
            paginationSize: 5,
            paginationSizeSelector: [5, 10, 15]
        });
    }
}

