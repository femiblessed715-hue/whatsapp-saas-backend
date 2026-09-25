const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 1. Health Check Endpoint
app.get('/', (req, res) => {
  res.json({ message: 'WhatsApp SaaS Backend is running smoothly!' });
});

// 2. Fetch Vendor Storefront & Products Endpoint
app.get('/api/vendor/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    // Fetch vendor details by slug
    const { data: vendor, error: vendorErr } = await supabase
      .from('vendors')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (vendorErr) {
      return res.status(500).json({ error: 'Database error fetching vendor', details: vendorErr });
    }

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found in database', queried_slug: slug });
    }

    // Fetch products belonging to vendor
    const { data: products, error: productErr } = await supabase
      .from('products')
      .select('*')
      .eq('vendor_id', vendor.id);

    if (productErr) {
      return res.status(500).json({ error: 'Database error fetching products', details: productErr });
    }

    res.json({ vendor, products });
  } catch (err) {
    res.status(500).json({ error: 'Server error', message: err.message });
  }
});

// 3. Create Order API Endpoint
app.post('/api/orders', async (req, res) => {
  try {
    const { vendor_id, customer_name, customer_phone, items } = req.body;

    const { data: vendor, error: vendorErr } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', vendor_id)
      .single();

    if (vendorErr || !vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    let totalAmount = 0;
    for (const item of items) {
      const { data: product } = await supabase
        .from('products')
        .select('price')
        .eq('id', item.product_id)
        .single();

      if (product) {
        totalAmount += product.price * item.quantity;
      }
    }

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert([{ vendor_id, customer_name, customer_phone, total_amount: totalAmount }])
      .select()
      .single();

    if (orderErr) {
      return res.status(500).json({ error: 'Failed to create order' });
    }

    res.json({ message: 'Order created successfully', order });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
