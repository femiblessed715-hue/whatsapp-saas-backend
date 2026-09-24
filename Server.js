require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Supabase Database Connection
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 1. Health Check Endpoint
app.get('/', (req, res) => {
  res.json({ message: 'WhatsApp SaaS Backend is running smoothly!' });
});

// 2. Create Order API Endpoint
app.post('/api/orders', async (req, res) => {
  try {
    const { vendor_id, customer_name, customer_phone, items, payment_method } = req.body;

    // Fetch vendor details
    const { data: vendor, error: vendorErr } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', vendor_id)
      .single();

    if (vendorErr || !vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Calculate order total
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

    // Insert order into Supabase database
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert([{
        vendor_id,
        customer_name,
        customer_phone,
        total_amount: totalAmount,
        payment_method,
        payment_status: 'PENDING'
      }])
      .select()
      .single();

    if (orderErr) throw orderErr;

    // Construct formatted WhatsApp order message
    const message = `*NEW ORDER #${order.id.slice(0, 8)}*\n` +
      `--------------------------\n` +
      `*Customer:* ${customer_name}\n` +
      `*Phone:* ${customer_phone}\n` +
      `*Total:* ${vendor.currency} ${totalAmount}\n` +
      `*Payment:* ${payment_method}\n\n` +
      `_Please confirm order receipt._`;

    const cleanPhone = vendor.phone_number.replace(/[^0-9]/g, '');
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    res.json({
      success: true,
      order,
      whatsappUrl
    });

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Port configuration for Render deployment
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
