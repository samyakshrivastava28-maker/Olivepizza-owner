import { adminDb } from '../../config/firebase.js';
import { knowledgeIndexer, DocumentMetadata } from './KnowledgeIndexer.js';
import { pineconeService } from './PineconeService.js';
import kb from '../KnowledgeBaseService.js';
import { syncWorker } from './PineconeSyncWorker.js';

export const STORE_PAGES_AND_FLOWS_KNOWLEDGE = [
  {
    documentId: 'page-contact-us',
    category: 'Store Info & Contact',
    tags: ['contact', 'address', 'phone', 'email', 'location', 'rajnandgaon', 'hours', 'timing'],
    content: `Page & Flow: Contact Us & Store Location
Route: /contact
Store Name: Olive Pizza Rajnandgaon
Location & Address: Main Road, Near Flyover, Rajnandgaon, Chhattisgarh 491441, India
Phone Number: +91 98765 43210 / +91 77442 12345
Email Support: support@olivepizza.com / orders@olivepizza.com
Store Operating Hours: Monday to Sunday, 11:00 AM to 11:00 PM IST
Dietary Policy: 100% Pure Vegetarian 🟢
Delivery Coverage: 8 km radius across Rajnandgaon city
Contact Page Features: Interactive contact form, direct phone link, live Google Maps store navigation, WhatsApp quick query link.`
  },
  {
    documentId: 'page-about-us',
    category: 'About Olive Pizza',
    tags: ['about', 'brand', 'story', 'pure veg', 'quality', 'artisan', 'ingredients'],
    content: `Page & Flow: About Olive Pizza
Route: /about
Brand Story: Olive Pizza is Rajnandgaon's premier 100% Pure Vegetarian artisan pizzeria. We craft hand-tossed sourdough pizzas, rich tomato sauces from vine-ripened tomatoes, and 100% real mozzarella cheese.
Key Pillars:
1. 100% Pure Vegetarian 🟢 (Zero Meat, Zero Eggs, Strict Hygiene & Pure Veg Guarantee).
2. Freshly Baked Dough (Made fresh daily, never frozen).
3. Premium Gourmet Ingredients (San Marzano style tomato sauce, fresh paneer, crisp farm veggies, liquid cheddar cheese burst).
4. Fast 30-45 Minute Doorstep Delivery.`
  },
  {
    documentId: 'page-live-tracking',
    category: 'Order Tracking & Delivery Flow',
    tags: ['tracking', 'order status', 'live tracking', 'map', 'delivery partner', 'eta'],
    content: `Page & Flow: Live Order Tracking
Route: /tracking
How to Track Order: After placing an order, navigate to /tracking or click "Track Order" in your order confirmation screen or AI assistant.
Order Lifecycle Stages:
1. Placed (Order received by store POS & verified).
2. Preparing (Artisan chef baking your pizza in oven - 15-20 mins).
3. Out for Delivery (Delivery partner assigned & picked up order).
4. Delivered (Order safely handed over at your doorstep).
Features: Real-time map GPS tracking of delivery rider, estimated arrival time counter (ETA), order item summary, rider contact button, and live FCM status notifications.`
  },
  {
    documentId: 'page-menu-and-customization',
    category: 'Menu & Pizza Customization',
    tags: ['menu', 'pizzas', 'customization', 'sizes', 'crusts', 'toppings', 'sides', 'drinks'],
    content: `Page & Flow: Menu & Pizza Customization Options
Route: /menu
Categories: Gourmet Pizzas, Garlic Breads & Sides, Beverages & Drinks, Special Combos.
Available Sizes:
- Small (7 inch, 4 slices, serves 1)
- Medium (10 inch, 6 slices, serves 2)
- Large (12 inch, 8 slices, serves 3-4)
Available Crust Types:
- Classic Crust (Soft & chewy artisan crust)
- Cheese Burst (+₹75, loaded with liquid cheddar & mozzarella inside crust)
- Thin Crust (Crispy light Italian crust)
- Pan Crust (Thick fluffy golden crust)
Extra Toppings: Extra Cheese, Fresh Paneer, Jalapenos, Mushrooms, Black Olives, Crisp Capsicum, Sweet Corn, Red Paprika, Onion.
Search & Filtering: Filter by price, category, veg tags, or keyword search.`
  },
  {
    documentId: 'page-cart-system',
    category: 'Cart & Basket Operations',
    tags: ['cart', 'add to cart', 'basket', 'quantity', 'coupons', 'promo code', 'price breakdown'],
    content: `Page & Flow: Shopping Cart & Basket System
Route: /cart
Cart Capabilities:
1. Item Management: Add items, update quantities, remove items, or clear cart with 1-click.
2. Customization Display: Shows selected size, crust, and add-on toppings for each item.
3. Promo Codes & Coupons: Enter discount code (e.g. BEST50 for ₹50 OFF, WELCOME100 for ₹100 OFF) to apply instant discounts.
4. Price Breakdown: Displays Item Subtotal, Taxes (5% GST), Delivery Fee (Free above ₹350, ₹30 standard), and Net Payable Amount.
5. Direct Checkout Button: Proceed seamlessly to Checkout.`
  },
  {
    documentId: 'page-checkout-and-payment',
    category: 'Checkout & Payment Flow',
    tags: ['checkout', 'payment', 'upi', 'cod', 'cash on delivery', 'address', 'razorpay', 'order placement'],
    content: `Page & Flow: Checkout & Payment Process
Route: /checkout
Step 1 - Address Selection: Pick saved address or enter new delivery address in Rajnandgaon with landmark and phone number.
Step 2 - Payment Method Selection:
- UPI (Google Pay, PhonePe, Paytm, BHIM UPI)
- Credit / Debit Card (Visa, Mastercard, RuPay via Razorpay)
- Net Banking
- Cash on Delivery (COD - Pay cash or UPI scan at doorstep)
Step 3 - Order Finalization: Review items, delivery address, final total, apply coupon, and click "Place Order".
Delivery Charges: FREE delivery on orders above ₹350. ₹30 standard delivery fee on orders under ₹350.`
  },
  {
    documentId: 'page-order-flow-and-fulfillment',
    category: 'Kitchen Order Fulfillment Flow',
    tags: ['order flow', 'fulfillment', 'kitchen', 'fcm notifications', 'sms', 'delivery time'],
    content: `Page & Flow: End-to-End Order Fulfillment Flow
Process:
1. Customer places order on website or via AI Assistant.
2. Kitchen POS receives order alert instantly via real-time WebSocket / Firestore listener.
3. Store accepts order -> Status updates to "Preparing".
4. Pizza baked in oven (15-20 mins) -> Packed in thermal heat-insulated box.
5. Delivery Partner assigned -> Status updates to "Out for Delivery".
6. Partner navigates to customer address (10-15 mins).
7. Delivered & Payment collected. Customer receives FCM notification and SMS updates.`
  },
  {
    documentId: 'page-customer-dashboard',
    category: 'Customer Dashboard & Profile',
    tags: ['dashboard', 'account', 'profile', 'order history', 'repeat order', 'addresses'],
    content: `Page & Flow: Customer Account Dashboard
Route: /customer/dashboard
Dashboard Features:
1. Order History: View past orders with full item details, invoices, and delivery timestamps.
2. 1-Click Repeat Order: Instantly add previous order items back into cart.
3. Address Book: Manage home, work, and saved delivery addresses.
4. Profile Settings: Update name, email, mobile phone number, and preferences.
5. Security & Auth: Truecaller login, Google 1-tap, phone OTP verification.`
  },
  {
    documentId: 'page-homepage-and-navigation',
    category: 'Home Page & Main Navigation',
    tags: ['home', 'homepage', 'hero banner', 'navigation', 'routes', 'combos', 'offers'],
    content: `Page & Flow: Home Page & App Navigation Structure
Route: /
Home Page Highlights:
- Hero Banner with hot daily deals & featured artisan pizzas.
- Quick Category Pills (Pizzas, Garlic Breads, Drinks, Combos).
- Top Recommended Pizzas carousel.
- Floating Cart button & Floating AI Concierge button.
Website Navigation Map:
- / -> Home Page
- /menu -> Full Menu & Search
- /cart -> Shopping Cart
- /checkout -> Order Checkout
- /tracking -> Live Order Map Tracking
- /contact -> Store Contact & Location
- /assistant -> 24/7 AI Concierge Chat
- /customer/dashboard -> Customer Account`
  },
  {
    documentId: 'page-location-and-delivery-zone',
    category: 'Location & Delivery Coverage',
    tags: ['location', 'delivery zone', 'coverage', 'rajnandgaon', 'radius', 'chhattisgarh'],
    content: `Page & Flow: Location & Delivery Coverage Zone
City & Region: Rajnandgaon, Chhattisgarh, India (Pincode: 491441)
Coverage Area: All areas within an 8 kilometer radius from Main Road Flyover, Rajnandgaon.
Popular Covered Localities: Ganj Para, Tulsi Pur, Kaurin Bhatha, Halwai Line, Basant Pur, Collectorate Area, Railway Station Road, Chikhali.
Delivery Guarantee: Fresh & piping hot within 30 to 45 minutes.`
  }
];

export class KnowledgeSync {
  public async syncAll(): Promise<{ success: boolean; stats: any }> {
    try {
      console.log('[KnowledgeSync] Queueing full sync to Pinecone worker...');
      let indexedCount = 0;
      
      // 1. Sync Settings
      const settings = kb.getSettings();
      if (settings) {
         syncWorker.enqueue('settings', 'store', settings);
         indexedCount++;
      }

      // 2. Sync Policies
      const policies = kb.getAllPolicies();
      for (const policy of policies) {
        syncWorker.enqueue('policies', policy.id, policy);
        indexedCount++;
      }

      // 3. Sync FAQs
      const faqs = kb.getAllFaqs();
      for (const faq of faqs) {
        syncWorker.enqueue('faqs', faq.id, faq);
        indexedCount++;
      }

      // 4. Sync Menu Products
      const products = kb.getAllProducts();
      for (const p of products) {
        syncWorker.enqueue('products', p.id, p);
        indexedCount++;
      }

      // 5. Sync Coupons
      const coupons = kb.getAllCoupons();
      for (const c of coupons) {
        if (!c.isActive) continue;
        syncWorker.enqueue('coupons', c.id, c);
        indexedCount++;
      }

      // 6. Sync Store Pages & Flows Knowledge
      for (const item of STORE_PAGES_AND_FLOWS_KNOWLEDGE) {
        syncWorker.enqueue('store_pages', item.documentId, item);
        indexedCount++;
      }

      console.log(`[KnowledgeSync] Successfully queued ${indexedCount} records for background Pinecone sync.`);
      
      return {
        success: true,
        stats: {
          syncedRecords: indexedCount,
        }
      };
    } catch (error: any) {
      console.error('[KnowledgeSync] Sync queueing failed:', error.message);
      return { success: false, stats: null };
    }
  }

  public async syncProduct(productId: string): Promise<void> {
    const p = kb.getAllProducts().find((x: any) => x.id === productId);
    if (!p) {
       syncWorker.enqueueDelete('products', productId);
       return;
    }
    syncWorker.enqueue('products', p.id, p);
  }
  public async syncCoupon(couponId: string): Promise<void> {
    const c = kb.getAllCoupons().find((x: any) => x.id === couponId);
    if (!c || !c.isActive) {
       syncWorker.enqueueDelete('coupons', couponId);
       return;
    }
    syncWorker.enqueue('coupons', c.id, c);
  }

  public async syncSetting(): Promise<void> {
    const settings = kb.getSettings();
    if (!settings) return;
    syncWorker.enqueue('settings', 'store', settings);
  }

  public async syncFaq(faqId: string): Promise<void> {
    const faq = kb.getAllFaqs().find((x: any) => x.id === faqId);
    if (!faq) {
       syncWorker.enqueueDelete('faqs', faqId);
       return;
    }
    syncWorker.enqueue('faqs', faq.id, faq);
  }

  public async syncPolicy(policyId: string): Promise<void> {
    const policy = kb.getAllPolicies().find((x: any) => x.id === policyId);
    if (!policy) {
       syncWorker.enqueueDelete('policies', policyId);
       return;
    }
    syncWorker.enqueue('policies', policy.id, policy);
  }
}

export const knowledgeSync = new KnowledgeSync();
