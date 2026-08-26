from flask import Flask, request, jsonify
import requests
import jwt
import hashlib
import os

app = Flask(__name__)

# VULNERABILITY: Hardcoded secret key
SECRET_KEY = 'my-super-secret-jwt-key-12345'
API_TOKEN = 'Bearer sk-abcdef1234567890abcdef1234567890'

# VULNERABILITY: Hardcoded database credentials
DB_CONFIG = {
    'host': 'localhost',
    'user': 'admin',
    'password': 'Admin123!',
    'database': 'api_db'
}

# In-memory "database"
users = {
    'admin': {'password': 'admin123', 'role': 'admin'},
    'user1': {'password': 'user123', 'role': 'user'}
}

products = [
    {'id': 1, 'name': 'Product 1', 'price': 100},
    {'id': 2, 'name': 'Product 2', 'price': 200}
]

# VULNERABILITY: Broken Authentication
@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if username in users and users[username]['password'] == password:
        token = jwt.encode(
            {'username': username, 'role': users[username]['role']},
            SECRET_KEY,
            algorithm='HS256'
        )
        return jsonify({'token': token})
    
    return jsonify({'error': 'Invalid credentials'}), 401

# VULNERABILITY: Broken Object Level Authorization (BOLA)
@app.route('/api/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    user_data = {'id': user_id, 'name': f'User {user_id}', 'email': f'user{user_id}@example.com'}
    return jsonify(user_data)

# VULNERABILITY: SQL Injection
@app.route('/api/products/search', methods=['GET'])
def search_products():
    query = request.args.get('q', '')
    if "'; DROP TABLE products; --" in query:
        return jsonify({'error': 'SQL injection detected'}), 400
    filtered = [p for p in products if query.lower() in p['name'].lower()]
    return jsonify(filtered)

# VULNERABILITY: Excessive Data Exposure
@app.route('/api/users/<int:user_id>/profile', methods=['GET'])
def get_user_profile(user_id):
    user_data = {
        'id': user_id,
        'name': f'User {user_id}',
        'email': f'user{user_id}@example.com',
        'password_hash': '5f4dcc3b5aa765d61d8327deb882cf99',
        'ssn': '123-45-6789',
        'credit_card': '4111-1111-1111-1111'
    }
    return jsonify(user_data)

# VULNERABILITY: Unrestricted Resource Consumption
@app.route('/api/upload', methods=['POST'])
def upload_file():
    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'No file provided'}), 400
    content = file.read()
    return jsonify({'message': 'File uploaded', 'size': len(content)})

# VULNERABILITY: Broken Function Level Authorization
@app.route('/api/admin/users', methods=['GET'])
def get_all_users():
    return jsonify(list(users.keys()))

# VULNERABILITY: SSRF
@app.route('/api/fetch', methods=['GET'])
def fetch_url():
    url = request.args.get('url', '')
    try:
        response = requests.get(url, timeout=5)
        return jsonify({'data': response.text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# VULNERABILITY: Security Misconfiguration
@app.route('/api/debug', methods=['GET'])
def debug_info():
    debug_data = {
        'secret_key': SECRET_KEY,
        'db_config': DB_CONFIG,
        'environment': os.environ.get('FLASK_ENV', 'production'),
        'debug': True
    }
    return jsonify(debug_data)

# VULNERABILITY: Mass Assignment
@app.route('/api/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    data = request.json
    return jsonify({'message': 'User updated', 'data': data})

# Health check
@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy'})

# OpenAPI spec endpoint
@app.route('/openapi.json', methods=['GET'])
def openapi_spec():
    return jsonify({
        'openapi': '3.0.0',
        'info': {'title': 'Sample API', 'version': '1.0.0'},
        'paths': {
            '/login': {'post': {'summary': 'User login'}},
            '/api/users/{user_id}': {'get': {'summary': 'Get user'}},
            '/api/products/search': {'get': {'summary': 'Search products'}},
            '/health': {'get': {'summary': 'Health check'}}
        }
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)