from flask import Flask, render_template, request, jsonify
from pymongo import MongoClient
from bson.objectid import ObjectId
from datetime import datetime
import random
from urllib.parse import quote_plus
import dns.resolver

# Fix DNS para resolver la ruta de MongoDB en Windows
dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
dns.resolver.default_resolver.nameservers = ['8.8.8.8', '1.1.1.1']

app = Flask(__name__)

# Credenciales de conexión
user = quote_plus("michelinsoftwaresolutions_db_user")
password = quote_plus("Romax2027")  # Coloca aquí la contraseña real que configuraste en Atlas

MONGO_URI = f"mongodb+srv://{user}:{password}@inframss.hrp0g3d.mongodb.net/sistema_inventario?retryWrites=true&w=majority&appName=INFRAMSS"

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)

# Prueba inicial de conexión
try:
    client.admin.command('ping')
    print("\n--------------------------------------------------")
    print(" ¡CONEXIÓN EXITOSA A MONGODB ATLAS!")
    print("--------------------------------------------------\n")
except Exception as e:
    print("\n--------------------------------------------------")
    print(" ERROR AL CONECTAR CON MONGODB:", e)
    print("--------------------------------------------------\n")

db = client['sistema_inventario']
categories_col = db['categories']
products_col = db['products']
sales_col = db['sales']

def format_doc(doc):
    doc['id'] = str(doc.pop('_id'))
    return doc

@app.route('/')
def index():
    return render_template('index.html')

# --- ENDPOINTS API ---

@app.route('/api/categories', methods=['GET', 'POST'])
def handle_categories():
    if request.method == 'POST':
        data = request.json
        if categories_col.find_one({'name': data['name']}):
            return jsonify({'error': 'La categoría ya existe'}), 400
        
        category = {
            'name': data['name'],
            'description': data.get('description', ''),
            'created_at': datetime.utcnow()
        }
        categories_col.insert_one(category)
        return jsonify({'message': 'Categoría creada con éxito'}), 201
    
    categories = list(categories_col.find())
    return jsonify([format_doc(c) for c in categories])

@app.route('/api/products', methods=['GET', 'POST'])
def handle_products():
    if request.method == 'POST':
        data = request.json
        if products_col.find_one({'code': data['code']}):
            return jsonify({'error': 'El código ya existe'}), 400
            
        barcode = data.get('barcode') or f"200{random.randint(1000000000, 9999999999)}"
        
        product = {
            'code': data['code'].upper(),
            'name': data['name'],
            'barcode': barcode,
            'category_id': data['categoryId'],
            'categoryName': data['categoryName'],
            'cost_price': float(data['costPrice']),
            'price': float(data['price']),
            'stock': int(data['stock']),
            'min_stock': int(data.get('minStock', 5)),
            'description': data.get('description', ''),
            'created_at': datetime.utcnow()
        }
        products_col.insert_one(product)
        return jsonify({'message': 'Producto creado con éxito'}), 201

    products = list(products_col.find())
    return jsonify([format_doc(p) for p in products])

@app.route('/api/sales', methods=['POST'])
def process_sale():
    data = request.json
    items_data = data.get('items', [])
    
    if not items_data:
        return jsonify({'error': 'El carrito está vacío'}), 400

    total_cost = 0.0
    total_revenue = 0.0
    total_profit = 0.0
    sale_items = []

    for item in items_data:
        product = products_col.find_one({'_id': ObjectId(item['productId'])})
        
        if not product or product['stock'] < item['quantity']:
            return jsonify({'error': 'Stock insuficiente'}), 400
        
        new_stock = product['stock'] - item['quantity']
        products_col.update_one(
            {'_id': ObjectId(item['productId'])}, 
            {'$set': {'stock': new_stock}}
        )
        
        subtotal = item['quantity'] * product['price']
        item_cost = item['quantity'] * product['cost_price']
        profit = subtotal - item_cost

        total_cost += item_cost
        total_revenue += subtotal
        total_profit += profit

        sale_items.append({
            'product_id': str(product['_id']),
            'product_name': product['name'],
            'quantity': item['quantity'],
            'cost_price': product['cost_price'],
            'price': product['price'],
            'subtotal': subtotal,
            'profit': profit
        })

    sale = {
        'customer_name': data.get('customerName', 'Cliente Anónimo'),
        'total_cost': total_cost,
        'total_revenue': total_revenue,
        'total_profit': total_profit,
        'items': sale_items,
        'date': datetime.utcnow()
    }

    result = sales_col.insert_one(sale)
    return jsonify({'message': 'Venta realizada con éxito', 'saleId': str(result.inserted_id)}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)