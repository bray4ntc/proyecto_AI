// Inicializar el mapa centrado en Puno, Perú
const map = L.map('map').setView([-15.840221, -70.021880], 13); // Coordenadas de Puno

// Agregar OpenStreetMap como capa base
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Coordenadas simuladas de los nodos
const cityCoordinates = {
    'A': [-15.8375, -70.0210],
    'B': [-15.8400, -70.0150],
    'C': [-15.8435, -70.0200],
    'D': [-15.8450, -70.0300]
};

// Convertir una ruta en nodos a coordenadas geográficas
function getRouteCoordinates(route) {
    return route.map(node => cityCoordinates[node]);
}


// Añadir marcador para el punto de inicio
function addMarker(lat, lng, label) {
    return L.marker([lat, lng]).addTo(map).bindPopup(label).openPopup();
}

// Añadir ruta en el mapa
function drawRoute(routeCoordinates) {
    L.polyline(routeCoordinates, { color: 'blue' }).addTo(map);
}
// Proposiciones lógicas para tráfico
const trafficPropositions = {
    morningRush: false,
    eveningRush: false,
    normalTraffic: false,
    highTraffic: false
};

// Proposiciones lógicas para clima
const weatherPropositions = {
    rain: false,
    snow: false,
    clear: false
};

// Función para actualizar las proposiciones de tráfico
function updateTrafficPropositions() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Convierte la hora actual a minutos desde las 00:00 para hacer comparaciones numéricas
    const currentTimeInMinutes = (hours * 60) + minutes;

    // Definir las horas pico en minutos desde las 00:00
    const morningRushStart = (8 * 60);   // 03:00 en minutos
    const morningRushEnd = (9 * 60);     // 05:00 en minutos
    const eveningRushStart = (17 * 60);  // 17:00 en minutos
    const eveningRushEnd = (19 * 60);    // 19:00 en minutos

    // Comparar la hora actual con los intervalos de horas pico
    trafficPropositions.morningRush = currentTimeInMinutes >= morningRushStart && currentTimeInMinutes <= morningRushEnd;
    trafficPropositions.eveningRush = currentTimeInMinutes >= eveningRushStart && currentTimeInMinutes <= eveningRushEnd;
    
    // Si no es hora pico, es tráfico normal
    trafficPropositions.normalTraffic = !(trafficPropositions.morningRush || trafficPropositions.eveningRush);
}



const API_KEY = '5072221009c7fb34129e9fd6f0f15068';
const CITY_ID = '3936456'; // Puedes usar el ID de la ciudad que deseas consultar

async function updateWeatherPropositions() {
    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?id=${CITY_ID}&appid=${API_KEY}&units=metric`);
        const data = await response.json();

        // Verifica si la solicitud fue exitosa
        if (data.cod !== 200) {
            console.error("Error al obtener el clima:", data.message);
            return;
        }

        // Aquí puedes ajustar las condiciones según tus necesidades
        const weatherCondition = data.weather[0].main.toLowerCase();
        weatherPropositions.rain = weatherCondition === "rain";
        weatherPropositions.snow = weatherCondition === "snow";
        weatherPropositions.clear = weatherCondition === "clear";
    } catch (error) {
        console.error("Error en la solicitud al clima:", error);
    }
}


// Función para calcular el multiplicador de tiempo
function calculateTimeMultiplier() {
    if (trafficPropositions.morningRush || trafficPropositions.eveningRush) {
        return weatherPropositions.rain ? 3.5 : 2.5; // Tráfico pesado con lluvia
    }
    if (trafficPropositions.normalTraffic) {
        return weatherPropositions.clear ? 1.0 : 1.8; // Tráfico normal o moderado con lluvia
    }
    return 1.0; // Sin tráfico
}

// Función para calcular el tiempo estimado de la ruta
function calculateRouteTime(distanceKm, trafficMultiplier) {
    const avgSpeedKmH = 50; // Supón una velocidad promedio de 50 km/h
    const timeHours = (distanceKm / avgSpeedKmH) * trafficMultiplier;
    return timeHours * 60; // Devuelve el tiempo en minutos
}

// Función para obtener la distancia de la ruta desde OSRM
async function getRouteDistance(startLatLng, endLatLng) {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLatLng[1]},${startLatLng[0]};${endLatLng[1]},${endLatLng[0]}?overview=false`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.routes.length) {
        const distanceMeters = data.routes[0].distance;
        return distanceMeters / 1000; // Convertir a kilómetros
    } else {
        console.error("No se pudo calcular la distancia.");
        return null;
    }
}
// Utilizar OSRM para obtener la ruta respetando las calles
async function getRoute(startLatLng, endLatLng) {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLatLng[1]},${startLatLng[0]};${endLatLng[1]},${endLatLng[0]}?overview=full&geometries=geojson`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.routes.length) {
        const routeCoordinates = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
        return routeCoordinates;
    } else {
        console.error("No se pudo encontrar la ruta.");
        return null;
    }
}

// Dibujar la ruta en el mapa
async function drawRouteOnMap(startLatLng, endLatLng) {
    const routeCoordinates = await getRoute(startLatLng, endLatLng);
    if (routeCoordinates) {
        L.polyline(routeCoordinates, { color: 'blue' }).addTo(map);
        // Añadir marcadores en los puntos de inicio y fin
        addMarker(startLatLng[0], startLatLng[1], "Inicio");
        addMarker(endLatLng[0], endLatLng[1], "Destino");
    }
}

// Función ajustada para calcular el tiempo estimado de la ruta y mostrar el clima
async function findBestRoute() {
    const startNode = document.getElementById('start').value.trim().toUpperCase();
    const endNode = document.getElementById('end').value.trim().toUpperCase();

    if (!cityCoordinates[startNode] || !cityCoordinates[endNode]) {
        alert('Por favor, ingrese nodos válidos');
        return;
    }

    const startLatLng = cityCoordinates[startNode];
    const endLatLng = cityCoordinates[endNode];

    // Actualizar proposiciones de tráfico y clima
    updateTrafficPropositions();
    await updateWeatherPropositions();

    // Obtener la distancia de la ruta
    const distanceKm = await getRouteDistance(startLatLng, endLatLng);

    if (distanceKm !== null) {
        const trafficMultiplier = calculateTimeMultiplier();
        const estimatedTime = calculateRouteTime(distanceKm, trafficMultiplier);

        // Mostrar el tiempo estimado
        console.log(`El tiempo estimado para la ruta es de: ${estimatedTime.toFixed(2)} minutos`);
        document.getElementById('time-output').innerText = `Tiempo estimado: ${estimatedTime.toFixed(2)} minutos`;

        // Mostrar la distancia
        document.getElementById('distance-output').innerText = `Distancia: ${distanceKm.toFixed(2)} km`;

        // Mostrar el clima debajo de la distancia
        let weatherText = '';
        if (weatherPropositions.rain) {
            weatherText = 'Clima: Lluvia';
        } else if (weatherPropositions.snow) {
            weatherText = 'Clima: Nieve';
        } else if (weatherPropositions.clear) {
            weatherText = 'Clima: Despejado';
        } else {
            weatherText = 'Clima: Desconocido';
        }

        document.getElementById('weather-output').innerText = weatherText;

        // Dibujar la ruta en el mapa
        await drawRouteOnMap(startLatLng, endLatLng);
    } else {
        console.error("No se pudo calcular la distancia.");
    }
}


// Asignar el evento al botón
document.getElementById('use-current-location').addEventListener('click', getCurrentLocation);


// Función para obtener la ubicación actual
function getCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            // Llenar el campo de texto con las coordenadas actuales
            document.getElementById('start').value = `(${lat}, ${lng})`; // Puedes personalizarlo
        }, (error) => {
            console.error("Error obteniendo la ubicación:", error);
            alert("No se pudo obtener la ubicación. Asegúrate de que la ubicación está habilitada.");
        });
    } else {
        alert("La geolocalización no es compatible con este navegador.");
    }
}

// Asignar el evento al botón
document.getElementById('use-current-location').addEventListener('click', getCurrentLocation);
