from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import requests
import json
import time
from datetime import datetime
from sqlalchemy import text
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
import logging

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Configure the PostgreSQL database
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:123456@localhost/weather_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Define the Weather model
class Weather(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    city = db.Column(db.String(100), unique=True, nullable=False)
    data = db.Column(db.JSON, nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self):
        return f'<Weather {self.city}>'

# Create the database tables
with app.app_context():
    db.create_all()

@app.route('/')
def serve_index():
    return send_from_directory('static', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('static', filename)

@app.route('/weather', methods=['GET'])
def get_weather_api():
    app.logger.info(f"Received request: {request.url}")
    app.logger.info(f"Request args: {request.args}")
    city = request.args.get('city')
    lat = request.args.get('lat')
    lon = request.args.get('lon')

    app.logger.info(f"Received weather request: city={city}, lat={lat}, lon={lon}")

    if lat and lon:
        return fetch_weather_by_coords(lat, lon)
    elif city:
        return get_weather_for_city(city)
    else:
        app.logger.warning("Weather request missing city or coordinates")
        return jsonify({'error': 'City or coordinates not provided'}), 400

def get_weather_for_city(city):
    app.logger.info(f"Getting weather for city: {city}")
    weather = Weather.query.filter_by(city=city).first()
    current_time = datetime.utcnow()
    
    if weather and (current_time - weather.timestamp).total_seconds() < 3600:  # Data is less than 1 hour old
        app.logger.info(f"Returning cached data for {city}")
        combined_data = weather.data
    else:
        app.logger.info(f"Fetching new data for {city}")
        combined_data = fetch_and_store_weather(city)
        if not combined_data:
            app.logger.warning(f"Could not fetch weather data for {city}")
            return jsonify({'error': f'Could not fetch weather data for {city}'}), 404

    # Format the data to work with both web and Android app
    formatted_data = {
        "current": combined_data['current'],
        "forecast": combined_data['forecast'],
        "android_format": {
            "cityName": combined_data['current']['name'],
            "temperature": combined_data['current']['main']['temp'],
            "description": combined_data['current']['weather'][0]['description'],
            "humidity": combined_data['current']['main']['humidity'],
            "pressure": combined_data['current']['main']['pressure'],
            "windSpeed": combined_data['current']['wind']['speed'],
            "windDirection": combined_data['current']['wind'].get('deg'),
            "cloudiness": combined_data['current']['clouds']['all'],
            "country": combined_data['current']['sys']['country']
        }
    }

    app.logger.info(f"Sending response: {json.dumps(formatted_data)}")
    return jsonify(formatted_data)
def fetch_and_store_weather(city):
    API_KEY = '820f3cf1558a68db5403f5d407db9051'
    weather_url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={API_KEY}&units=metric"
    forecast_url = f"https://api.openweathermap.org/data/2.5/forecast?q={city}&appid={API_KEY}&units=metric"
    
    app.logger.info(f"Fetching weather for {city}")
    weather_response = requests.get(weather_url)
    forecast_response = requests.get(forecast_url)
    
    app.logger.info(f"Weather status: {weather_response.status_code}")
    app.logger.info(f"Forecast status: {forecast_response.status_code}")
    
    if weather_response.status_code == 200 and forecast_response.status_code == 200:
        weather_data = weather_response.json()
        forecast_data = forecast_response.json()

        app.logger.info(f"Forecast data: {json.dumps(forecast_data, indent=2)}")
        
        combined_data = {
            "current": weather_data,
            "forecast": forecast_data
        }
        
        weather = Weather.query.filter_by(city=city).first()
        if weather:
            weather.data = combined_data
            weather.timestamp = datetime.utcnow()
        else:
            weather = Weather(city=city, data=combined_data)
            db.session.add(weather)
        
        db.session.commit()
        app.logger.info(f"Weather data stored for {city}")
        return combined_data
    else:
        app.logger.error(f"Failed to fetch weather data for {city}")
        app.logger.error(f"Weather response: {weather_response.text}")
        app.logger.error(f"Forecast response: {forecast_response.text}")
        return None

def fetch_weather_by_coords(lat, lon):
    API_KEY = '820f3cf1558a68db5403f5d407db9051'
    weather_url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
    forecast_url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
    
    app.logger.info(f"Fetching weather for coordinates: lat={lat}, lon={lon}")
    weather_response = requests.get(weather_url)
    forecast_response = requests.get(forecast_url)
    
    app.logger.info(f"Weather status: {weather_response.status_code}")
    app.logger.info(f"Forecast status: {forecast_response.status_code}")
    
    if weather_response.status_code == 200 and forecast_response.status_code == 200:
        weather_data = weather_response.json()
        forecast_data = forecast_response.json()
        
        combined_data = {
            "current": weather_data,
            "forecast": forecast_data
        }
        
        formatted_data = {
            "source": "external",
            "data": combined_data,
            "android_format": {
                "cityName": weather_data['name'],
                "temperature": weather_data['main']['temp'],
                "description": weather_data['weather'][0]['description'],
                "humidity": weather_data['main']['humidity'],
                "pressure": weather_data['main']['pressure'],
                "windSpeed": weather_data['wind']['speed'],
                "windDirection": weather_data['wind'].get('deg'),
                "cloudiness": weather_data['clouds']['all'],
                "country": weather_data['sys']['country']
            }
        }
        
        return jsonify(formatted_data)
    else:
        app.logger.error(f"Failed to fetch weather data for coordinates: lat={lat}, lon={lon}")
        app.logger.error(f"Weather response: {weather_response.text}")
        app.logger.error(f"Forecast response: {forecast_response.text}")
        return jsonify({'error': 'Could not fetch weather data for coordinates'}), 404

@app.route('/weather', methods=['POST'])
def update_weather_api():
    data = request.json
    if not data or 'city' not in data or 'data' not in data:
        app.logger.warning("Received invalid data for weather update")
        return jsonify({'error': 'Invalid data provided'}), 400
    
    city = data['city']
    weather_data = data['data']
    
    weather = Weather.query.filter_by(city=city).first()
    if weather:
        weather.data = weather_data
        weather.timestamp = datetime.utcnow()
    else:
        weather = Weather(city=city, data=weather_data)
        db.session.add(weather)
    
    db.session.commit()
    app.logger.info(f"Weather data updated for {city}")
    return jsonify({'message': 'Weather data updated successfully'}), 200

@app.route('/clear_weather', methods=['POST'])
def clear_weather():
    try:
        # Delete all entries
        num_deleted = Weather.query.delete()
        
        # Reset the ID sequence
        db.session.execute(text("ALTER SEQUENCE weather_id_seq RESTART WITH 1"))
        
        db.session.commit()
        app.logger.info(f"Cleared {num_deleted} weather entries from the database and reset ID sequence")
        return jsonify({"message": f"Successfully cleared {num_deleted} weather entries and reset ID sequence"}), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        error_msg = str(e.__dict__['orig'])
        app.logger.error(f"SQLAlchemy error clearing weather data: {error_msg}")
        return jsonify({"error": f"Database error: {error_msg}"}), 500
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Unexpected error clearing weather data: {str(e)}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@app.route('/delete_city/<city>', methods=['DELETE'])
def delete_city(city):
    try:
        weather = Weather.query.filter_by(city=city).first()
        if weather:
            db.session.delete(weather)
            db.session.commit()
            app.logger.info(f"Deleted weather data for {city}")
            return jsonify({"message": f"Successfully deleted weather data for {city}"}), 200
        else:
            app.logger.warning(f"No weather data found for {city}")
            return jsonify({"message": f"No weather data found for {city}"}), 404
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error deleting weather data for {city}: {str(e)}")
        return jsonify({"error": f"Failed to delete weather data for {city}"}), 500

@app.route('/check_weather')
def check_weather():
    weathers = Weather.query.all()
    app.logger.info(f"Checking weather data. Total entries: {len(weathers)}")
    return jsonify([{'city': w.city, 'timestamp': str(w.timestamp)} for w in weathers])

@app.route('/database_details')
def database_details():
    weathers = Weather.query.all()
    details = []
    for weather in weathers:
        details.append({
            'city': weather.city,
            'timestamp': str(weather.timestamp),
            'data_preview': str(weather.data)[:100] + '...' if weather.data else None
        })
    return jsonify(details)

@app.route('/test_db')
def test_db():
    try:
        db.session.execute(text('SELECT 1'))
        app.logger.info("Database connection test successful")
        return 'Database connection successful!'
    except Exception as e:
        app.logger.error(f"Database connection test failed: {str(e)}")
        return f'Database connection failed: {str(e)}'

@app.route('/<path:path>')
def catch_all(path):
    app.logger.warning(f"Caught unhandled request: {path}")
    return jsonify({"error": "Not found"}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)