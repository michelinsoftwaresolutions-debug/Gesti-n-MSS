// Ocultar overlay de carga al iniciar
window.addEventListener('load', () => {
    setTimeout(() => {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }, 1500);
});

// Variables de estado local
let categories = [];
let products = [];
let sales = [];
let cart = [];
let currentEditingProduct = null;
let currentEditingCategory = null;

// Inicialización de la App
document.addEventListener('DOMContentLoaded', () => {
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const loginPassword = document.getElementById('loginPassword');

    if (togglePasswordBtn && loginPassword) {
        togglePasswordBtn.addEventListener('click', () => {
            const currentType = loginPassword.getAttribute('type');
            if (currentType === 'password') {
                loginPassword.setAttribute('type', 'text');
                togglePasswordBtn.textContent = '🙈';
            } else {
                loginPassword.setAttribute('type', 'password');
                togglePasswordBtn.textContent = '👁️';
            }
        });
    }
});

// --- PANTALLA Y MÁSCARA DE CARGA ---
function showMainApp() {
    const login = document.getElementById('loginScreen');
    const main = document.getElementById('mainApp');
    if (login) login.style.display = 'none';
    if (main) main.style.display = 'block';
}

function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = show ? 'block' : 'none';
}

function setSyncStatus(status) {
    const syncElement = document.getElementById('syncStatus');
    if (!syncElement) return;
    syncElement.className = 'sync-status';

    switch (status) {
        case 'success':
            syncElement.textContent = 'MongoDB Conectado';
            syncElement.classList.add('sync-success');
            break;
        case 'error':
            syncElement.textContent = 'Error de Conexión';
            syncElement.classList.add('sync-error');
            break;
        case 'pending':
            syncElement.textContent = 'Cargando...';
            syncElement.classList.add('sync-pending');
            break;
    }
}

// --- CONEXIÓN CON FLASK / PYTHON ---
async function loadUserData() {
    showLoading(true);
    setSyncStatus('pending');
    try {
        await Promise.all([
            loadCategories(),
            loadProducts()
        ]);
        updateAllData();
        setSyncStatus('success');
    } catch (error) {
        console.error('Error al cargar datos de Python:', error);
        setSyncStatus('error');
        showAlert('Error al conectar con el servidor Flask', 'error');
    } finally {
        showLoading(false);
    }
}

async function loadCategories() {
    const res = await fetch('/api/categories');
    if (res.ok) {
        categories = await res.json();
    }
}

async function loadProducts() {
    const res = await fetch('/api/products');
    if (res.ok) {
        products = await res.json();
    }
}

// --- NAVEGACIÓN Y TABS ---
window.showSection = function(sectionName) {
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));

    const activeSection = document.getElementById(sectionName);
    if (activeSection) activeSection.classList.add('active');
    if (window.event && window.event.target) window.event.target.classList.add('active');

    updateSectionData(sectionName);
};

function updateSectionData(sectionName) {
    switch (sectionName) {
        case 'dashboard':
            updateDashboard();
            break;
        case 'categories':
            updateCategoriesTable();
            break;
        case 'products':
            updateProductsTable();
            updateProductCategories();
            break;
        case 'sales':
            updateSaleProducts();
            const barcodeScan = document.getElementById('saleBarcodeScanInput');
            if (barcodeScan) barcodeScan.focus();
            break;
        case 'reports':
            updateReports();
            break;
    }
}

function updateAllData() {
    updateCategoriesTable();
    updateProductsTable();
    updateProductCategories();
    updateSaleProducts();
    updateDashboard();
    updateReports();
}

// --- GESTIÓN DE CATEGORÍAS ---
window.addCategory = async function() {
    const name = document.getElementById('categoryName').value.trim();
    const description = document.getElementById('categoryDescription').value.trim();

    if (!name) {
        showAlert('Por favor, ingrese el nombre de la categoría', 'error');
        return;
    }

    showLoading(true);
    try {
        const res = await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al guardar categoría');

        showAlert('Categoría agregada correctamente', 'success');
        clearCategoryForm();
        await loadCategories();
        updateAllData();
    } catch (err) {
        showAlert(err.message, 'error');
    } finally {
        showLoading(false);
    }
};

window.clearCategoryForm = function() {
    document.getElementById('categoryName').value = '';
    document.getElementById('categoryDescription').value = '';
    currentEditingCategory = null;
};

window.searchCategories = function() {
    const searchTerm = document.getElementById('categorySearch').value.toLowerCase();
    const filtered = categories.filter(c =>
        (c.name && c.name.toLowerCase().includes(searchTerm)) ||
        (c.description && c.description.toLowerCase().includes(searchTerm))
    );
    updateCategoriesTable(filtered);
};

function updateCategoriesTable(categoriesToShow = categories) {
    const tbody = document.getElementById('categoriesTableBody');
    if (!tbody) return;

    if (categoriesToShow.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #666;">No hay categorías registradas</td></tr>';
        return;
    }

    tbody.innerHTML = categoriesToShow.map(category => `
        <tr>
            <td><strong>${category.name || '-'}</strong></td>
            <td>${category.description || '-'}</td>
            <td><span class="category-tag">${category.product_count || 0} productos</span></td>
            <td>-</td>
            <td class="product-actions">
                <button class="btn btn-danger btn-small" onclick="showAlert('Funcionalidad en desarrollo', 'info')" title="Eliminar">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// --- GESTIÓN DE PRODUCTOS ---
function updateProductCategories() {
    const selects = [document.getElementById('productCategory'), document.getElementById('priceUpdateCategory')];
    selects.forEach(select => {
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = select.id === 'priceUpdateCategory' ?
            '<option value="">Todas las categorías</option>' :
            '<option value="">Seleccionar categoría...</option>';

        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id || category._id;
            option.textContent = category.name;
            select.appendChild(option);
        });

        if (currentValue && categories.find(c => (c.id || c._id) === currentValue)) {
            select.value = currentValue;
        }
    });
}

window.addProduct = async function() {
    const name = document.getElementById('productName').value.trim();
    const code = document.getElementById('productCode').value.trim();
    const barcode = document.getElementById('productBarcode').value.trim();
    const categorySelect = document.getElementById('productCategory');
    const categoryId = categorySelect.value;
    const categoryName = categorySelect.options[categorySelect.selectedIndex]?.text || '';

    const costPrice = parseFloat(document.getElementById('productCostPrice').value);
    const price = parseFloat(document.getElementById('productPrice').value);
    const stock = parseInt(document.getElementById('productStock').value);
    const minStock = parseInt(document.getElementById('productMinStock').value) || 5;
    const description = document.getElementById('productDescription').value.trim();

    if (!name || !code || !categoryId || isNaN(costPrice) || isNaN(price) || isNaN(stock)) {
        showAlert('Por favor, complete todos los campos obligatorios (*)', 'error');
        return;
    }

    showLoading(true);
    try {
        const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name, code, barcode, categoryId, categoryName,
                costPrice, price, stock, minStock, description
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al guardar producto');

        showAlert('Producto guardado con éxito', 'success');
        clearProductForm();
        await loadProducts();
        updateAllData();
    } catch (err) {
        showAlert(err.message, 'error');
    } finally {
        showLoading(false);
    }
};

window.clearProductForm = function() {
    document.getElementById('productName').value = '';
    document.getElementById('productCode').value = '';
    document.getElementById('productBarcode').value = '';
    document.getElementById('productCategory').value = '';
    document.getElementById('productCostPrice').value = '';
    document.getElementById('productPrice').value = '';
    document.getElementById('productStock').value = '';
    document.getElementById('productMinStock').value = '';
    document.getElementById('productDescription').value = '';
    currentEditingProduct = null;
};

window.searchProducts = function() {
    const searchTerm = document.getElementById('productSearch').value.toLowerCase();
    const filtered = products.filter(p =>
        (p.name && p.name.toLowerCase().includes(searchTerm)) ||
        (p.code && p.code.toLowerCase().includes(searchTerm)) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(searchTerm)) ||
        (p.barcode && p.barcode.includes(searchTerm))
    );
    updateProductsTable(filtered);
};

function updateProductsTable(productsToShow = products) {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    if (productsToShow.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #666;">No hay productos registrados</td></tr>';
        return;
    }

    tbody.innerHTML = productsToShow.map(product => {
        const stockStatus = getStockStatus(product);
        const rowClass = stockStatus === 'Sin stock' ? 'out-of-stock' : (stockStatus === 'Stock bajo' ? 'low-stock' : '');
        
        const costPrice = Number(product.costPrice ?? product.cost_price ?? 0);
        const price = Number(product.price ?? 0);
        const margin = price > 0 ? (((price - costPrice) / price) * 100).toFixed(1) : 0;

        return `
            <tr class="${rowClass}">
                <td><strong>${product.code || '-'}</strong></td>
                <td>${product.name || '-'}</td>
                <td><span class="category-tag">${product.categoryName || '-'}</span></td>
                <td>$${costPrice.toFixed(2)}</td>
                <td>$${price.toFixed(2)}</td>
                <td class="${margin > 0 ? 'profit-positive' : 'profit-negative'}">${margin}%</td>
                <td><strong>${product.stock ?? 0}</strong></td>
                <td style="font-family: monospace; font-size: 12px;">${product.barcode || '-'}</td>
                <td><span class="status-badge">${stockStatus}</span></td>
                <td class="product-actions">
                    <button class="btn btn-danger btn-small" onclick="showAlert('Funcionalidad en desarrollo', 'info')" title="Eliminar">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

function getStockStatus(product) {
    const stock = product.stock ?? 0;
    const minStock = product.minStock ?? 5;
    if (stock === 0) return 'Sin stock';
    if (stock <= minStock) return 'Stock bajo';
    return 'Disponible';
}

// --- PUNTO DE VENTA Y ESCANEO ---
function handleBarcodeScan(event) {
    if (event.key === 'Enter') {
        const barcodeInput = event.target;
        const barcode = barcodeInput.value.trim();
        if (!barcode) return;

        const product = products.find(p => p.barcode === barcode);
        if (product) {
            addProductToCartByBarcode(product);
        } else {
            showAlert(`Producto con código "${barcode}" no encontrado.`, 'error');
        }
        barcodeInput.value = '';
    }
}

function addProductToCartByBarcode(product) {
    const stock = product.stock ?? 0;
    if (stock <= 0) {
        showAlert(`Stock insuficiente para "${product.name}".`, 'error');
        return;
    }

    const productId = product.id || product._id;
    const price = Number(product.price ?? 0);
    const costPrice = Number(product.costPrice ?? product.cost_price ?? 0);

    const existingItem = cart.find(item => item.productId === productId);
    if (existingItem) {
        if (existingItem.quantity + 1 > stock) {
            showAlert(`Stock insuficiente. Ya tiene ${existingItem.quantity} en el carrito.`, 'error');
            return;
        }
        existingItem.quantity += 1;
        existingItem.subtotal = existingItem.quantity * price;
        existingItem.profit = existingItem.quantity * (price - costPrice);
    } else {
        cart.push({
            productId: productId,
            productName: product.name,
            quantity: 1,
            price: price,
            costPrice: costPrice,
            subtotal: price,
            profit: price - costPrice
        });
    }
    updateCartTable();
    showAlert(`"${product.name}" agregado al carrito.`, 'success');
}

window.selectProduct = function() {
    const productId = document.getElementById('saleProduct').value;
    const product = products.find(p => (p.id || p._id) === productId);
    if (product) {
        const price = Number(product.price ?? 0);
        document.getElementById('salePrice').value = price;
        document.getElementById('saleQuantity').value = 1;
        updateSaleSubtotal();
    } else {
        document.getElementById('salePrice').value = '';
        document.getElementById('saleQuantity').value = '';
        document.getElementById('saleSubtotal').value = '';
    }
};

window.updateSaleSubtotal = function() {
    const quantity = parseInt(document.getElementById('saleQuantity').value) || 0;
    const price = parseFloat(document.getElementById('salePrice').value) || 0;
    document.getElementById('saleSubtotal').value = (quantity * price).toFixed(2);
};

window.addToSale = function() {
    const productId = document.getElementById('saleProduct').value;
    const quantity = parseInt(document.getElementById('saleQuantity').value);
    const price = parseFloat(document.getElementById('salePrice').value);

    if (!productId || !quantity || !price || quantity <= 0) {
        showAlert('Por favor, complete todos los campos de venta', 'error');
        return;
    }

    const product = products.find(p => (p.id || p._id) === productId);
    const stock = product ? (product.stock ?? 0) : 0;
    const costPrice = product ? Number(product.costPrice ?? product.cost_price ?? 0) : 0;

    if (!product || quantity > stock) {
        showAlert('Stock insuficiente o producto no válido', 'error');
        return;
    }

    cart.push({
        productId,
        productName: product.name,
        quantity,
        price,
        costPrice,
        subtotal: quantity * price,
        profit: quantity * (price - costPrice)
    });

    updateCartTable();
    clearSaleForm();
    showAlert('Producto agregado al carrito', 'success');
};

window.removeFromCart = function(index) {
    cart.splice(index, 1);
    updateCartTable();
};

function updateCartTable() {
    const tbody = document.getElementById('cartTableBody');
    const totalElement = document.getElementById('saleTotal');
    const totalCostElement = document.getElementById('totalCost');
    const totalProfitElement = document.getElementById('totalProfit');
    const completeSaleBtn = document.getElementById('completeSaleBtn');

    if (!tbody) return;

    if (cart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">Carrito vacío</td></tr>';
        if (totalElement) totalElement.textContent = '0.00';
        if (totalCostElement) totalCostElement.textContent = '0.00';
        if (totalProfitElement) totalProfitElement.textContent = '0.00';
        if (completeSaleBtn) completeSaleBtn.disabled = true;
        return;
    }

    const total = cart.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const totalCost = cart.reduce((sum, item) => sum + ((item.quantity || 0) * (item.costPrice || 0)), 0);
    const totalProfit = cart.reduce((sum, item) => sum + (item.profit || 0), 0);

    tbody.innerHTML = cart.map((item, index) => {
        const price = Number(item.price ?? 0);
        const subtotal = Number(item.subtotal ?? 0);
        const profit = Number(item.profit ?? 0);
        return `
            <tr>
                <td>${item.productName || '-'}</td>
                <td>${item.quantity || 0}</td>
                <td>$${price.toFixed(2)}</td>
                <td>$${subtotal.toFixed(2)}</td>
                <td class="${profit >= 0 ? 'profit-positive' : 'profit-negative'}">$${profit.toFixed(2)}</td>
                <td><button class="btn btn-danger btn-small" onclick="removeFromCart(${index})">🗑️</button></td>
            </tr>
        `;
    }).join('');

    if (totalElement) totalElement.textContent = total.toFixed(2);
    if (totalCostElement) totalCostElement.textContent = totalCost.toFixed(2);
    if (totalProfitElement) totalProfitElement.textContent = totalProfit.toFixed(2);
    if (completeSaleBtn) completeSaleBtn.disabled = false;
}

window.completeSale = async function() {
    if (cart.length === 0) {
        showAlert('El carrito está vacío', 'error');
        return;
    }

    const customerName = document.getElementById('customerName').value.trim() || 'Cliente Anónimo';

    showLoading(true);
    try {
        const res = await fetch('/api/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customerName,
                items: cart.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity
                }))
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al completar la venta');

        showAlert('¡Venta realizada con éxito!', 'success');
        clearCart();
        await loadProducts();
        updateAllData();
    } catch (err) {
        showAlert(err.message, 'error');
    } finally {
        showLoading(false);
    }
};

window.clearCart = function() {
    cart = [];
    updateCartTable();
    clearSaleForm();
};

function clearSaleForm() {
    const productSelect = document.getElementById('saleProduct');
    const quantityInput = document.getElementById('saleQuantity');
    const priceInput = document.getElementById('salePrice');
    const subtotalInput = document.getElementById('saleSubtotal');
    const customerInput = document.getElementById('customerName');

    if (productSelect) productSelect.value = '';
    if (quantityInput) quantityInput.value = '';
    if (priceInput) priceInput.value = '';
    if (subtotalInput) subtotalInput.value = '';
    if (customerInput) customerInput.value = '';
}

function updateSaleProducts() {
    const select = document.getElementById('saleProduct');
    if (!select) return;

    select.innerHTML = '<option value="">Seleccionar producto...</option>';
    products.filter(p => (p.stock ?? 0) > 0).forEach(product => {
        const option = document.createElement('option');
        option.value = product.id || product._id;
        const price = Number(product.price ?? 0);
        option.textContent = `${product.name} - $${price.toFixed(2)} (Stock: ${product.stock ?? 0})`;
        select.appendChild(option);
    });
}

// --- DASHBOARD Y REPORTES ---
function updateDashboard() {
    const totalProd = document.getElementById('totalProducts');
    const totalCat = document.getElementById('totalCategories');
    const lowStock = document.getElementById('lowStockItems');

    if (totalProd) totalProd.textContent = products.length;
    if (totalCat) totalCat.textContent = categories.length;

    const lowStockList = products.filter(p => (p.stock ?? 0) <= (p.minStock ?? 5));
    if (lowStock) lowStock.textContent = lowStockList.length;

    updateLowStockTable(lowStockList);
}

function updateLowStockTable(lowStockItems) {
    const tbody = document.getElementById('lowStockTableBody');
    if (!tbody) return;

    if (lowStockItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">No hay productos con stock bajo</td></tr>';
        return;
    }

    tbody.innerHTML = lowStockItems.map(product => `
        <tr class="low-stock">
            <td><strong>${product.name || '-'}</strong></td>
            <td><span class="category-tag">${product.categoryName || '-'}</span></td>
            <td><strong>${product.stock ?? 0}</strong></td>
            <td>${product.minStock ?? 5}</td>
            <td style="font-family: monospace; font-size: 12px;">${product.barcode || '-'}</td>
            <td><button class="btn btn-warning btn-small" onclick="showSection('products')">📦 Reabastecer</button></td>
        </tr>
    `).join('');
}

function updateReports() {
    const repProd = document.getElementById('reportTotalProducts');
    if (repProd) repProd.textContent = products.length;
}

// --- ALERTAS DE LA INTERFAZ ---
function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;

    const container = document.querySelector('.container') || document.body;
    container.insertBefore(alertDiv, container.firstChild);

    setTimeout(() => {
        if (alertDiv.parentNode) alertDiv.remove();
    }, 4000);
}

window.logout = function() {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');

    // Ocultar el panel principal y mostrar el login
    if (mainApp) mainApp.style.display = 'none';
    if (loginScreen) loginScreen.style.display = 'block';

    // Limpiar el carrito en memoria
    cart = [];
    
    showAlert('Sesión cerrada correctamente', 'success');
};
