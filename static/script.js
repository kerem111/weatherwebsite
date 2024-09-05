const timeEl = document.getElementById('time');
const dateEl = document.getElementById('date');
const currentWeatherItemsEl = document.getElementById('current-weather-items');
const timezone = document.getElementById('time-zone');
const countryEl = document.getElementById('country');
const weatherForecastEl = document.getElementById('weather-forecast');
const currentTempEl = document.getElementById('current-temp');
const searchBar = document.getElementById('search-bar');
const getWeatherBtn = document.getElementById('get-weather-btn');
const suggestions = document.getElementById('suggestions');

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let cities = [];

// Fetch cities list
fetch('cities500.json')
    .then(response => response.json())
    .then(data => {
        cities = data;
        console.log('Cities data loaded:', cities);
    })
    .catch(err => console.error('Error fetching city list:', err));

searchBar.addEventListener('input', searchCity);
getWeatherBtn.addEventListener('click', fetchWeatherByCity);

// Add event listener for Enter key press
searchBar.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        fetchWeatherByCity();
    }
});

function showLoadingIndicator() {
    document.getElementById('loading-indicator').style.display = 'block';
}

function hideLoadingIndicator() {
    document.getElementById('loading-indicator').style.display = 'none';
}

function showErrorMessage(message) {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function hideErrorMessage() {
    document.getElementById('error-message').style.display = 'none';
}

function getCurrentLocationWeather() {
    console.log("Getting current location");
    showLoadingIndicator();
    hideErrorMessage();
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                console.log(`Detected coordinates: Lat ${lat}, Lon ${lon}`);
                getWeatherDataByCoords(lat, lon);
            },
            error => {
                console.error('Geolocation error:', error);
                hideLoadingIndicator();
                handleGeolocationError(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } else {
        hideLoadingIndicator();
        showErrorMessage('Geolocation is not supported by this browser. Please enter a city manually.');
    }
}
function handleGeolocationError(error) {
    let errorMessage;
    switch(error.code) {
        case error.PERMISSION_DENIED:
            errorMessage = "You denied the request for geolocation. Please enter a city manually.";
            break;
        case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable. Please enter a city manually.";
            break;
        case error.TIMEOUT:
            errorMessage = "The request to get user location timed out. Please enter a city manually.";
            break;
        default:
            errorMessage = "An unknown error occurred. Please enter a city manually.";
    }
    showErrorMessage(errorMessage);
}

function getWeatherDataByCoords(lat, lon) {
    showLoadingIndicator();
    fetch(`/weather?lat=${lat}&lon=${lon}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log('Weather data by coords:', data);
            if (data.source === 'external') {
                updateCurrentWeather(data.data.current);
                updateForecast(data.data.forecast);
            } else {
                updateCurrentWeather(data.current);
                updateForecast(data.forecast);
            }
            document.getElementById('current-info').classList.remove('hidden');
            document.getElementById('future-forecast').classList.remove('hidden');
            hideLoadingIndicator();
        })
        .catch(err => {
            console.error('Error fetching weather data:', err);
            hideLoadingIndicator();
            showErrorMessage('Error fetching weather data. Please try again or enter a city manually.');
        });
}
function searchCity() {
    const query = searchBar.value.toLowerCase();
    suggestions.innerHTML = '';
    if (query) {
        const filteredCities = cities.filter(city => city.name.toLowerCase().startsWith(query)).slice(0, 10);
        filteredCities.forEach(city => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            suggestionItem.textContent = `${city.name}, ${city.country}`;
            suggestionItem.onclick = () => selectCity(city.name);
            suggestions.appendChild(suggestionItem);
        });
        suggestions.style.display = 'block';
    } else {
        suggestions.style.display = 'none';
    }
}

function selectCity(city) {
    searchBar.value = city;
    suggestions.style.display = 'none';
    fetchWeatherByCity();
}

function fetchWeatherByCity() {
    const city = searchBar.value;
    if (city) {
        getWeatherData(city);
    } else {
        alert('Please enter a city name');
    }
}

function getWeatherData(city) {
    fetch(`/weather?city=${city}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            console.log('Fetched weather data:', data);

            if (!data || !data.current || !data.forecast) {
                console.error('Invalid weather data structure:', data);
                alert("We couldn't find any city with this name, please enter the city name correctly!");
                return;
            }

            console.log('Current Weather Data:', data.current);
            console.log('Forecast Weather Data:', data.forecast);

            updateCurrentWeather(data.current);
            updateForecast(data.forecast);
            document.getElementById('current-info').classList.remove('hidden');
            document.getElementById('future-forecast').classList.remove('hidden');
        })
        .catch(err => {
            console.error('Error fetching weather data:', err);
            alert("We couldn't find any city with this name, please enter the city name correctly!");
        });
}

function updateCurrentWeather(data) {
    if (!data.main || !data.weather || !data.wind || !data.sys) {
        console.error('Incomplete current weather data:', data);
        alert('Incomplete current weather data received.');
        return;
    }

    const { main, name, sys, weather, wind } = data;
    const { temp, humidity, pressure } = main;
    const { country, sunrise, sunset } = sys;
    const { description, icon } = weather[0];
    const { speed: windSpeed } = wind;

    timezone.innerHTML = name;
    countryEl.innerHTML = country;

    const sunriseTime = new Date(sunrise * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const sunsetTime = new Date(sunset * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    currentWeatherItemsEl.innerHTML = `
        <div class="weather-item">
            <div>Temperature</div>
            <div>${temp}&#176; C</div>
        </div>
        <div class="weather-item">
            <div>Humidity</div>
            <div>${humidity} %</div>
        </div>
        <div class="weather-item">
            <div>Pressure</div>
            <div>${pressure} hPa</div>
        </div>
        <div class="weather-item">
            <div>Wind Speed</div>
            <div>${windSpeed} m/s</div>
        </div>
        <div class="weather-item">
            <div>Sunrise</div>
            <div>${sunriseTime}</div>
        </div>
        <div class="weather-item">
            <div>Sunset</div>
            <div>${sunsetTime}</div>
        </div>
        <div class="weather-item">
            <div>Weather</div>
            <div>${description}</div>
        </div>
        <div class="weather-item">
            <div>Icon</div>
            <img src="http://openweathermap.org/img/wn/${icon}@2x.png" alt="weather icon">
        </div>
    `;

    updateCurrentDayForecast(data);
}

function updateCurrentDayForecast(data) {
    if (!data.main || !data.weather) {
        console.error('Incomplete current day weather data:', data);
        alert('Incomplete current day weather data received.');
        return;
    }

    const { main, weather } = data;
    const { temp } = main;
    const icon = weather[0].icon;
    const dayName = days[new Date().getDay()];

    currentTempEl.innerHTML = `
        <img src="http://openweathermap.org/img/wn/${icon}@2x.png" alt="weather icon" class="w-icon">
        <div class="other">
            <div class="day">${dayName}</div>
            <div class="temp">Current - ${temp}&#176; C</div>
        </div>
    `;
}

function updateForecast(data) {
    weatherForecastEl.innerHTML = '';
    if (!data.list) {
        console.error('No forecast data available:', data);
        alert('No forecast data available for this city.');
        return;
    }

    const dailyForecast = {};
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    data.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const dateString = date.toDateString();
        const hours = date.getHours();
        const temp = item.main.temp;
        const icon = item.weather[0].icon;
        
        if (date.getTime() <= currentDate.getTime()) {
            return;
        }

        if (!dailyForecast[dateString]) {
            dailyForecast[dateString] = {
                dayName: days[date.getDay()],
                dayTemps: [],
                nightTemps: [],
                dayIcon: null,
                nightIcon: null
            };
        }

        if (hours >= 6 && hours < 18) {
            dailyForecast[dateString].dayTemps.push(temp);
            dailyForecast[dateString].dayIcon = icon;
        } else {
            dailyForecast[dateString].nightTemps.push(temp);
            dailyForecast[dateString].nightIcon = icon;
        }
    });

    const forecastItems = Object.values(dailyForecast).slice(0, 5);

    forecastItems.forEach((item, index) => {
        const dayTemp = item.dayTemps.length ? Math.max(...item.dayTemps) : 'N/A';
        const nightTemp = item.nightTemps.length ? Math.min(...item.nightTemps) : 'N/A';
        
        console.log(`Day: ${item.dayName}, Day Temp: ${dayTemp}, Night Temp: ${nightTemp}, Day Icon: ${item.dayIcon}, Night Icon: ${item.nightIcon}`);
        appendForecastItem(item.dayName, dayTemp, nightTemp, item.dayIcon, item.nightIcon);
    });
}

function appendForecastItem(dayName, dayTemp, nightTemp, dayIcon, nightIcon) {
    const forecastItem = document.createElement('div');
    forecastItem.className = 'weather-forecast-item';
    forecastItem.innerHTML = `
        <div class="day">${dayName}</div>
        <img src="http://openweathermap.org/img/wn/${dayIcon || '01d'}@2x.png" alt="day weather icon" class="w-icon">
        <div class="temp">Day - ${dayTemp !== 'N/A' ? dayTemp.toFixed(1) + '° C' : 'N/A'}</div>
        <img src="http://openweathermap.org/img/wn/${nightIcon || '01n'}@2x.png" alt="night weather icon" class="w-icon">
        <div class="temp">Night - ${nightTemp !== 'N/A' ? nightTemp.toFixed(1) + '° C' : 'N/A'}</div>
    `;
    weatherForecastEl.appendChild(forecastItem);
}
function updateTimeAndDate() {
    const time = new Date();
    const month = time.getMonth();
    const date = time.getDate();
    const day = time.getDay();
    const hour = time.getHours();
    const hoursIn12HrFormat = hour >= 13 ? hour % 12 : hour;
    const minutes = time.getMinutes();
    const ampm = hour >= 12 ? 'PM' : 'AM';

    timeEl.innerHTML = `${hoursIn12HrFormat}:${minutes < 10 ? '0' + minutes : minutes} ${ampm}`;
    dateEl.innerHTML = `${days[day]}, ${date} ${months[month]}`;
}

window.onload = function() {
    console.log("Window loaded, getting current location weather");
    getCurrentLocationWeather();
    updateTimeAndDate();
    setInterval(updateTimeAndDate, 1000);
};