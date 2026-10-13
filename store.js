(() => {
  'use strict';

  const STORE_KEY = 'mercado-atlas-store-v1';
  const $ = (selector, scope = document) => scope.querySelector(selector);
  let products = window.STORE_PRODUCTS || [];
  let categories = window.STORE_CATEGORIES || [];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const money = { USD: { locale:'en-US', currency:'USD', rate:1 }, PEN: { locale:'es-PE', currency:'PEN', rate:3.72 }, EUR: { locale:'de-DE', currency:'EUR', rate:.92 } };
  const shipping = { USD:12.9, PEN:16, EUR:9.9 };
  const freeFrom = { USD:100, PEN:360, EUR:90 };
  let state = loadState();
  let category = 'todos';
  let query = '';
  let sort = 'recommended';
  let showCount = 8;
  let favoritesOnly = false;

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return { cart:Array.isArray(saved.cart)?saved.cart:[], orders:Array.isArray(saved.orders)?saved.orders:[], favorites:Array.isArray(saved.favorites)?saved.favorites:[], currency:money[saved.currency]?saved.currency:'USD', coupon:saved.coupon||'' };
    } catch { return { cart:[], orders:[], favorites:[], currency:'USD', coupon:'' }; }
  }
  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch { toast('No se pudo guardar la tienda en este navegador.', true); }
  }
  const productById = id => products.find(product => product.id === id || product.slug === id);
  const getPrice = cents => (Number(cents || 0) / 100) * money[state.currency].rate;
  function formatPrice(cents) {
    return new Intl.NumberFormat(money[state.currency].locale, { style:'currency', currency:money[state.currency].currency, maximumFractionDigits:2 }).format(getPrice(cents));
  }
  function cartCount() { return state.cart.reduce((sum,item)=>sum + Number(item.quantity||0),0); }
  function subtotalCents() { return state.cart.reduce((sum,item)=>sum + (productById(item.productId)?.priceCents||0) * item.quantity,0); }
  function discountCents() {
    const subtotal = subtotalCents();
    if (state.coupon === 'ATLAS10') return Math.round(subtotal * .10);
    if (state.coupon === 'BIENVENIDA5') return Math.min(subtotal, Math.round(500 / money[state.currency].rate));
    return 0;
  }
  function shippingCents() {
    const net = Math.max(0, subtotalCents() - discountCents());
    const threshold = Math.round(freeFrom[state.currency] / money[state.currency].rate * 100);
    return !net || net >= threshold ? 0 : Math.round(shipping[state.currency] / money[state.currency].rate * 100);
  }
  function totalCents() { return Math.max(0, subtotalCents() - discountCents()) + shippingCents(); }
  function productMatches(product) {
    const text = `${product.name} ${product.description} ${product.category}`.toLocaleLowerCase('es');
    return (category === 'todos' || product.category === category)
      && (!favoritesOnly || state.favorites.includes(product.id))
      && (!query || text.includes(query.trim().toLocaleLowerCase('es')));
  }
  function visibleProducts() {
    const result = products.filter(productMatches);
    if (sort === 'price-asc') result.sort((a,b)=>a.priceCents-b.priceCents);
    if (sort === 'price-desc') result.sort((a,b)=>b.priceCents-a.priceCents);
    if (sort === 'rating') result.sort((a,b)=>b.rating-a.rating);
    if (sort === 'name') result.sort((a,b)=>a.name.localeCompare(b.name,'es'));
    return result;
  }
  function productCard(product) {
    const favorite = state.favorites.includes(product.id);
    return `<article class="shop-product">
      <div class="shop-product-image" style="--product-wash:${esc(product.color||'#f1eee8')}">
        <button class="shop-favorite ${favorite?'is-favorite':''}" data-store-action="favorite" data-id="${esc(product.id)}" aria-label="${favorite?'Quitar de':'Agregar a'} favoritos">${favorite?'♥':'♡'}</button>
        ${product.badge?`<span class="shop-badge">${esc(product.badge)}</span>`:''}
        <button class="shop-product-open" data-store-action="details" data-id="${esc(product.id)}" aria-label="Ver detalles de ${esc(product.name)}"><img loading="lazy" src="${esc(product.image)}" alt="${esc(product.name)}" onerror="this.style.visibility='hidden'"></button>
        <button class="shop-add-overlay" data-store-action="add" data-id="${esc(product.id)}">Agregar a la bolsa <span>＋</span></button>
      </div>
      <div class="shop-product-meta"><span>${esc(categoryName(product.category))}</span><span>★ ${Number(product.rating).toFixed(1)}</span></div>
      <button class="shop-product-name" data-store-action="details" data-id="${esc(product.id)}">${esc(product.name)}</button>
      <div class="shop-product-price"><strong>${formatPrice(product.priceCents)}</strong>${product.compareCents?`<del>${formatPrice(product.compareCents)}</del>`:''}<span>${product.stock>0?'Disponible':'Agotado'}</span></div>
    </article>`;
  }
  function categoryName(slug) { return categories.find(item=>item.slug===slug)?.name || slug; }
  function renderStoreView() {
    const list = visibleProducts();
    const shown = list.slice(0,showCount);
    const remaining = Math.max(0,list.length-shown.length);
    const cartQty = cartCount();
    $('#mainContent').innerHTML = `<div class="store-page">
      <div class="store-eyebrow"><span>UNA SELECCIÓN EN EVOLUCIÓN</span><span>ENVÍOS INTERNACIONALES · PAGO DE DEMOSTRACIÓN</span></div>
      <section class="store-hero">
        <div class="store-hero-copy"><span class="store-kicker">OBJETOS PARA TODOS LOS DÍAS</span><h1>Encuentra algo<br><em>que te acompañe.</em></h1><p>Una colección curada de diseño, tecnología y pequeños hallazgos para hacer tu mundo más tuyo.</p><div class="store-hero-actions"><button class="btn btn-primary" data-store-action="scroll-products">Explorar la tienda <span>↗</span></button><button class="store-link-button" data-view-link="dashboard">Ir al panel de clientes ↓</button></div><div class="store-hero-note"><span class="store-note-mark">M·A</span><span>Compra con intención,<br>desde cualquier lugar.</span></div></div>
        <div class="store-hero-art"><div class="hero-orbit orbit-one"></div><div class="hero-orbit orbit-two"></div><img src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=85" alt="Auriculares de la colección" onerror="this.style.opacity='.12'"><div class="hero-art-label"><span>01 / 04</span><strong>Diseño para llevar</strong><span>Tecnología · Estilo · Bienestar</span></div><div class="hero-art-star">✳</div></div>
      </section>
      <div class="store-promise"><span>✳ Selección cuidada</span><span>⌁ Envíos internacionales</span><span>◇ Compra de prueba segura</span><span>♡ Personas primero</span><button class="store-cart-shortcut" data-store-action="cart">♧ Mi bolsa <b>${cartQty}</b></button></div>
      <section class="store-explore" id="shopCollection"><div class="store-section-heading"><div><span class="store-kicker">EMPIEZA POR AQUÍ</span><h2>Pequeños hallazgos.<br><em>Grandes favoritos.</em></h2></div><p>Diseño útil, materiales honestos y detalles que se sienten bien. Descubre la colección completa.</p></div>
        <div class="shop-toolbar"><label class="shop-search"><span>⌕</span><input id="shopSearch" type="search" value="${esc(query)}" placeholder="Buscar en la colección…" aria-label="Buscar productos"></label><label class="shop-control"><span>Moneda</span><select id="shopCurrency" aria-label="Moneda"><option value="USD" ${state.currency==='USD'?'selected':''}>USD $</option><option value="PEN" ${state.currency==='PEN'?'selected':''}>PEN S/</option><option value="EUR" ${state.currency==='EUR'?'selected':''}>EUR €</option></select></label><label class="shop-control shop-sort"><span>Ordenar por</span><select id="shopSort" aria-label="Ordenar productos"><option value="recommended" ${sort==='recommended'?'selected':''}>Recomendados</option><option value="price-asc" ${sort==='price-asc'?'selected':''}>Precio: menor a mayor</option><option value="price-desc" ${sort==='price-desc'?'selected':''}>Precio: mayor a menor</option><option value="rating" ${sort==='rating'?'selected':''}>Mejor valorados</option><option value="name" ${sort==='name'?'selected':''}>Nombre A–Z</option></select></label></div>
        <div class="shop-categories"><button class="shop-chip ${category==='todos'&&!favoritesOnly?'selected':''}" data-store-category="todos">Todo <span>${products.length}</span></button>${categories.map(item=>`<button class="shop-chip ${category===item.slug&&!favoritesOnly?'selected':''}" data-store-category="${esc(item.slug)}">${esc(item.name)}</button>`).join('')}<button class="shop-chip ${favoritesOnly?'selected':''}" data-store-action="favorites">♡ Guardados <span>${state.favorites.length}</span></button><span class="shop-result-count">${list.length} hallazgos para explorar</span></div>
        <div class="shop-grid" id="shopGrid">${shown.length?shown.map(productCard).join(''):`<div class="shop-empty"><span>⌕</span><strong>No encontramos resultados</strong><p>Prueba otra búsqueda, categoría o vuelve a explorar todo.</p><button class="btn btn-secondary" data-store-action="reset-filters">Ver colección completa</button></div>`}</div>
        ${remaining?`<div class="shop-more-wrap"><button class="btn btn-secondary" data-store-action="more">Ver ${Math.min(remaining,8)} productos más ↓</button></div>`:''}
      </section>
      <section class="store-feature"><div><span class="store-kicker">UNA PAUSA, UN NUEVO COMIENZO</span><h2>Haz espacio para<br><em>lo que te inspira.</em></h2><p>Objetos seleccionados para renovar tu rutina, regalar con intención o simplemente darte un gusto.</p><button class="btn btn-light" data-store-action="scroll-products">Descubrir la selección ↗</button></div><div class="store-feature-image"><img loading="lazy" src="https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=950&q=85" alt="Lámpara de diseño para el hogar" onerror="this.style.opacity='.15'"><span>SELECCIÓN DE TEMPORADA<br>UNIDADES LIMITADAS</span></div></section>
      <section class="store-community"><div><span class="store-kicker">MERCADO ATLAS, EN POCAS PALABRAS</span><h2>Comprar mejor<br><em>se siente diferente.</em></h2><p>Buscamos objetos bien pensados, de los que se quedan contigo. Una selección pequeña en cada detalle y grande en posibilidades.</p></div><div class="store-review"><span class="review-stars">★★★★★</span><p>“La tienda es muy fácil de explorar. Encontré un regalo especial y el seguimiento del pedido fue claro.”</p><strong>Comunidad Atlas <span>· Compra de demostración</span></strong></div><div class="store-stats"><strong>${products.length}<small>+</small></strong><span>hallazgos para<br>explorar</span></div></section>
      <footer class="store-footer"><a href="#" class="store-footer-brand" data-view-link="store">M · A <span>Mercado Atlas</span></a><p>Buenos hallazgos. Desde cualquier lugar.</p><div><button data-view-link="clients">Gestión de clientes</button><button data-view-link="orders">Pedidos de prueba</button><span>© ${new Date().getFullYear()} · Demostración sin cobros reales</span></div></footer>
    </div>`;
    $('#shopSearch').addEventListener('input', event => { query=event.target.value; showCount=8; rerenderStoreResults(); });
    $('#shopCurrency').addEventListener('change', event => { state.currency=money[event.target.value]?event.target.value:'USD'; saveState(); renderStoreView(); });
    $('#shopSort').addEventListener('change', event => { sort=event.target.value; showCount=8; rerenderStoreResults(); });
  }
  function rerenderStoreResults() {
    const list=visibleProducts(),shown=list.slice(0,showCount),grid=$('#shopGrid');
    if(!grid)return;
    grid.innerHTML=shown.length?shown.map(productCard).join(''):`<div class="shop-empty"><span>⌕</span><strong>No encontramos resultados</strong><p>Prueba otra búsqueda, categoría o vuelve a explorar todo.</p><button class="btn btn-secondary" data-store-action="reset-filters">Ver colección completa</button></div>`;
    $('.shop-result-count').textContent=`${list.length} hallazgos para explorar`;
    $('.shop-more-wrap')?.remove();
    if(list.length>shown.length)grid.insertAdjacentHTML('afterend',`<div class="shop-more-wrap"><button class="btn btn-secondary" data-store-action="more">Ver ${Math.min(list.length-shown.length,8)} productos más ↓</button></div>`);
    document.querySelectorAll('[data-store-category]').forEach(button=>button.classList.toggle('selected',!favoritesOnly&&button.dataset.storeCategory===category));
  }
  function renderOrders() {
    const orders=state.orders.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    const revenue=orders.reduce((sum,order)=>sum+Number(order.totalCents||0),0);
    $('#mainContent').innerHTML=`<div class="orders-page"><div class="page-heading"><div><div class="eyebrow">COMERCIO</div><h1>Pedidos de la tienda</h1><p>Registro de compras de demostración realizadas en este navegador.</p></div><button class="btn btn-primary" data-view-link="store">＋ Explorar tienda</button></div><section class="stats-grid"><article class="stat-card"><div class="stat-top"><span>Pedidos registrados</span><span class="stat-icon blue">▤</span></div><div class="stat-number">${orders.length}</div><div class="stat-foot">Compras de demostración</div></article><article class="stat-card"><div class="stat-top"><span>Venta de prueba</span><span class="stat-icon green">↗</span></div><div class="stat-number">${formatPrice(revenue)}</div><div class="stat-foot">Sin cobros reales</div></article><article class="stat-card"><div class="stat-top"><span>Artículos vendidos</span><span class="stat-icon pink">✳</span></div><div class="stat-number">${orders.reduce((sum,o)=>sum+o.items.reduce((n,item)=>n+item.quantity,0),0)}</div><div class="stat-foot">Unidades de muestra</div></article></section><section class="panel orders-panel"><div class="panel-heading"><div><h2>Historial de pedidos</h2><p>La información se almacena localmente en este navegador.</p></div><span class="badge badge-prospect">${orders.length} pedidos</span></div>${orders.length?`<div class="order-list">${orders.map(order=>`<article class="order-card"><div class="order-card-top"><div><span class="order-number">${esc(order.number)}</span><span class="order-date">${esc(order.createdAtLabel)}</span></div><span class="badge badge-due">${esc(order.status)}</span></div><div class="order-items">${order.items.map(item=>`<span>${esc(item.name)} <b>× ${item.quantity}</b></span>`).join('')}</div><div class="order-card-bottom"><span>${esc(order.customer.name)} · ${esc(order.customer.country)}</span><strong>${formatPrice(order.totalCents)}</strong></div></article>`).join('')}</div>`:`<div class="shop-empty"><span>▤</span><strong>Aún no hay pedidos</strong><p>Los pedidos de prueba aparecerán aquí después de completar una compra.</p><button class="btn btn-primary" data-view-link="store">Ir a la tienda</button></div>`}</section></div>`;
  }
  function renderCart() {
    const body=$('#cartBody'),footer=$('#cartFooter');
    $('#drawerCartCount').textContent=cartCount();
    if(!state.cart.length){body.innerHTML='<div class="cart-empty"><span>♧</span><strong>Tu bolsa está esperando</strong><p>Explora la colección y guarda algo que te acompañe.</p><button class="btn btn-primary" data-close="cartModalBackdrop">Seguir explorando</button></div>';footer.innerHTML='';return;}
    body.innerHTML=`<div class="cart-shipping-hint">${shippingCents()===0?'✳ Envío gratis aplicado.':`Agrega ${formatPrice(Math.max(0,Math.round(freeFrom[state.currency]/money[state.currency].rate*100)-(subtotalCents()-discountCents())))} para obtener envío gratis.`}</div><div class="cart-lines">${state.cart.map(item=>{const p=productById(item.productId);if(!p)return '';return `<article class="cart-line"><img src="${esc(p.image)}" alt="${esc(p.name)}" onerror="this.style.opacity='.15'"><div class="cart-line-info"><strong>${esc(p.name)}</strong><span>${formatPrice(p.priceCents)}</span><div class="quantity-control"><button data-store-action="quantity" data-id="${esc(p.id)}" data-delta="-1" aria-label="Restar">−</button><b>${item.quantity}</b><button data-store-action="quantity" data-id="${esc(p.id)}" data-delta="1" aria-label="Sumar">＋</button></div></div><button class="cart-remove" data-store-action="remove" data-id="${esc(p.id)}" aria-label="Quitar ${esc(p.name)}">×</button></article>`}).join('')}</div><div class="coupon-row"><input id="couponInput" placeholder="Código de descuento" value="${esc(state.coupon)}" aria-label="Código de descuento"><button data-store-action="coupon">Aplicar</button></div><p class="coupon-help">Prueba ATLAS10 o BIENVENIDA5</p>`;
    footer.innerHTML=`<div class="cart-total-row"><span>Subtotal</span><span>${formatPrice(subtotalCents())}</span></div>${discountCents()?`<div class="cart-total-row discount"><span>Descuento · ${esc(state.coupon)}</span><span>− ${formatPrice(discountCents())}</span></div>`:''}<div class="cart-total-row"><span>Envío estimado</span><span>${shippingCents()?formatPrice(shippingCents()):'Gratis'}</span></div><div class="cart-total-row cart-grand-total"><strong>Total estimado</strong><strong>${formatPrice(totalCents())}</strong></div><button class="btn btn-primary cart-checkout" data-store-action="checkout">Continuar al envío <span>↗</span></button><small>Demostración: no se solicitará información de pago ni se cobrará.</small>`;
  }
  function openCart() { renderCart(); document.body.style.overflow='hidden'; $('#cartModalBackdrop').classList.add('open'); }
  function addToCart(id) {
    const product=productById(id);if(!product||product.stock<1){toast('Este producto no está disponible.',true);return;}
    const item=state.cart.find(line=>line.productId===product.id);
    if(item){if(item.quantity>=product.stock){toast('Llegaste al inventario disponible de demostración.',true);return;}item.quantity++;}else state.cart.push({productId:product.id,quantity:1});
    saveState();updateCartBadge();toast(`${product.name} se agregó a tu bolsa.`);
  }
  function updateCartBadge() {
    const count=cartCount();
    const button=$('#topAddBtn');
    if(button&&document.body.dataset.currentView==='store')button.innerHTML=`♧ Mi bolsa <span class="header-cart-count">${count}</span>`;
    const shortcut=$('.store-cart-shortcut b');if(shortcut)shortcut.textContent=count;
  }
  function toggleFavorite(id) {
    const product=productById(id);if(!product)return;
    state.favorites=state.favorites.includes(product.id)?state.favorites.filter(item=>item!==product.id):[...state.favorites,product.id];
    saveState();rerenderStoreResults();
  }
  function openProduct(id) {
    const product=productById(id);if(!product)return;
    $('#productModalTitle').textContent=product.name;
    $('#productModalBody').innerHTML=`<div class="product-detail"><div class="product-detail-image" style="--product-wash:${esc(product.color||'#f1eee8')}"><img src="${esc(product.image)}" alt="${esc(product.name)}" onerror="this.style.opacity='.15'"></div><div class="product-detail-copy"><span class="store-kicker">${esc(categoryName(product.category))} · ★ ${Number(product.rating).toFixed(1)} (${product.reviews} opiniones)</span><h3>${esc(product.name)}</h3><p>${esc(product.description)}</p><div class="product-detail-price">${formatPrice(product.priceCents)} ${product.compareCents?`<del>${formatPrice(product.compareCents)}</del>`:''}</div><div class="product-stock">${product.stock>0?`● Disponible · ${product.stock} unidades de demostración`:'Agotado'}</div><button class="btn btn-primary" data-store-action="add-and-close" data-id="${esc(product.id)}">Agregar a la bolsa <span>＋</span></button><small>Envío internacional disponible · pago de prueba, sin cobro real.</small></div></div>`;
    document.body.style.overflow='hidden';$('#productModalBackdrop').classList.add('open');
  }
  function submitCoupon() {
    const input=$('#couponInput'),code=(input?.value||'').trim().toUpperCase();
    if(!code){state.coupon='';saveState();renderCart();toast('Código de descuento eliminado.');return;}
    if(!['ATLAS10','BIENVENIDA5'].includes(code)){toast('Ese código no es válido. Prueba ATLAS10 o BIENVENIDA5.',true);return;}
    state.coupon=code;saveState();renderCart();toast(`Código ${code} aplicado.`);
  }
  async function createApiOrder(customer) {
    if (location.protocol === 'file:') return null;
    const countryCodes={'Perú':'PE','Estados Unidos':'US','Canadá':'CA','México':'MX','Colombia':'CO','Chile':'CL','Argentina':'AR','España':'ES','Francia':'FR','Alemania':'DE','Italia':'IT','Reino Unido':'GB'};
    try {
      const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:customer.name,email:customer.email,currency:state.currency,coupon:state.coupon,items:state.cart.map(item=>({id:item.productId,quantity:item.quantity})),address:{street:customer.address,city:customer.city,postal:customer.postal,country:countryCodes[customer.country]||'PE'}})});
      const data=await response.json().catch(()=>({}));
      if(response.status===404)return null;
      if(!response.ok)throw new Error(data.error||'No se pudo guardar el pedido en la base de datos.');
      return data;
    } catch(error) { if(error instanceof TypeError)return null; throw error; }
  }
  async function finishCheckout(event) {
    event.preventDefault();
    if(!state.cart.length){toast('Tu bolsa está vacía.',true);return;}
    const customer={name:$('#orderName').value.trim(),email:$('#orderEmail').value.trim().toLowerCase(),phone:$('#orderPhone').value.trim(),country:$('#orderCountry').value,address:$('#orderAddress').value.trim(),city:$('#orderCity').value.trim(),postal:$('#orderPostal').value.trim()};
    if(!customer.name||!customer.email||!customer.country||!customer.address||!customer.city){$('#checkoutFormError').textContent='Completa tu nombre, correo y dirección de entrega.';$('#checkoutFormError').classList.add('show');return;}
    const submitButton=$('#checkoutForm button[type="submit"]');submitButton.disabled=true;submitButton.textContent='Guardando pedido…';
    let apiOrder;
    try { apiOrder=await createApiOrder(customer); }
    catch(error) { $('#checkoutFormError').textContent=error.message||'No se pudo registrar el pedido. Revisa los datos e inténtalo de nuevo.';$('#checkoutFormError').classList.add('show');submitButton.disabled=false;submitButton.textContent='Confirmar pedido de prueba';return; }
    submitButton.disabled=false;submitButton.textContent='Confirmar pedido de prueba';
    const items=state.cart.map(item=>{const p=productById(item.productId);return p?{productId:p.id,name:p.name,quantity:item.quantity,unitPriceCents:p.priceCents,lineTotalCents:p.priceCents*item.quantity}:null;}).filter(Boolean);
    const baseAmount=value=>apiOrder?Math.round(Number(value||0)/money[state.currency].rate):Number(value||0);
    const order={id:apiOrder?.id||uid(),number:apiOrder?.code||`MA-${new Date().getFullYear()}-${String(state.orders.length+1).padStart(4,'0')}`,createdAt:new Date().toISOString(),createdAtLabel:new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short'}).format(new Date()),status:apiOrder?.status==='confirmed'?'Confirmado · demo':'En preparación · demo',currency:state.currency,coupon:state.coupon,subtotalCents:baseAmount(apiOrder?.subtotal??subtotalCents()),discountCents:baseAmount(apiOrder?.discount??discountCents()),shippingCents:baseAmount(apiOrder?.shipping??shippingCents()),taxCents:baseAmount(apiOrder?.tax??0),totalCents:baseAmount(apiOrder?.total??totalCents()),customer,items};
    state.orders.unshift(order);state.cart=[];state.coupon='';saveState();
    if(typeof window.addStoreBuyerToCRM==='function')window.addStoreBuyerToCRM(customer,order.number);
    $('#checkoutForm').reset();$('#checkoutFormError').classList.remove('show');$('#checkoutModalBackdrop').classList.remove('open');$('#cartModalBackdrop').classList.remove('open');document.body.style.overflow='';updateCartBadge();
    toast(`Pedido ${order.number} guardado. No se realizó ningún cobro.`);window.setView?.('orders');
  }
  function toast(message,error=false) {
    const el=$('#toast');if(!el)return;el.textContent=message;el.classList.toggle('error',error);el.classList.add('show');clearTimeout(window.__shopToastTimer);window.__shopToastTimer=setTimeout(()=>el.classList.remove('show'),3000);
  }
  function getStats() { return { orders:state.orders.length, revenueCents:state.orders.reduce((sum,o)=>sum+Number(o.totalCents||0),0), cartCount:cartCount() }; }

  document.addEventListener('click',event=>{
    const categoryButton=event.target.closest('[data-store-category]');
    if(categoryButton){category=categoryButton.dataset.storeCategory;favoritesOnly=false;showCount=8;rerenderStoreResults();return;}
    const action=event.target.closest('[data-store-action]');if(!action)return;
    const id=action.dataset.id;
    switch(action.dataset.storeAction){
      case 'scroll-products':$('#shopCollection')?.scrollIntoView({behavior:'smooth'});break;
      case 'cart':openCart();break;
      case 'add':addToCart(id);break;
      case 'details':openProduct(id);break;
      case 'add-and-close':$('#productModalBackdrop').classList.remove('open');document.body.style.overflow='';addToCart(id);break;
      case 'favorite':toggleFavorite(id);break;
      case 'favorites':favoritesOnly=!favoritesOnly;category='todos';showCount=8;rerenderStoreResults();break;
      case 'more':showCount+=8;rerenderStoreResults();break;
      case 'reset-filters':query='';category='todos';favoritesOnly=false;showCount=8;renderStoreView();break;
      case 'quantity':{const item=state.cart.find(line=>line.productId===id),p=productById(id);if(!item||!p)break;const next=item.quantity+Number(action.dataset.delta);if(next<1)state.cart=state.cart.filter(line=>line.productId!==id);else if(next<=p.stock)item.quantity=next;else toast('No hay más unidades disponibles en esta demostración.',true);saveState();renderCart();updateCartBadge();break;}
      case 'remove':state.cart=state.cart.filter(line=>line.productId!==id);saveState();renderCart();updateCartBadge();break;
      case 'coupon':submitCoupon();break;
      case 'checkout':$('#checkoutFormError').classList.remove('show');$('#checkoutModalBackdrop').classList.add('open');break;
    }
  });
  document.addEventListener('click',event=>{if(event.target.closest('[data-close="cartModalBackdrop"]')){document.body.style.overflow='';}});
  $('#checkoutForm').addEventListener('submit',finishCheckout);
  window.openStoreCart=openCart;
  window.renderStoreView=renderStoreView;
  window.renderStoreOrders=renderOrders;
  window.storeStats=getStats;
  window.refreshStoreBadge=updateCartBadge;
  if(location.protocol!=='file:')fetch('/api/products').then(response=>response.ok?response.json():null).then(list=>{if(Array.isArray(list)&&list.length){products=list;if(window.STORE_CATEGORIES?.length)categories=window.STORE_CATEGORIES;if(document.body.dataset.currentView==='store')renderStoreView();}}).catch(()=>{});
})();
