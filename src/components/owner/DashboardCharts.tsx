import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { motion } from 'framer-motion';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface DashboardChartsProps {
  ordersData: any[]; // Expecting aggregated order data
  productsData: any[]; // Expecting products sales data
}

export default function DashboardCharts({ ordersData, productsData }: DashboardChartsProps) {
  const hasOrders = ordersData.length > 0;
  
  // Aggregate revenue by date for the last 7 days
  const last7Days = Array.from({length: 7}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  // Real mapping logic
  const revenueByDay = last7Days.map(dateStr => {
    return ordersData.reduce((acc, order) => {
      if(!order.createdAt) return acc;
      const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return orderDate === dateStr ? acc + (order.totalAmount || 0) : acc;
    }, 0);
  });

  const ordersByDay = last7Days.map(dateStr => {
    return ordersData.reduce((acc, order) => {
      if(!order.createdAt) return acc;
      const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return orderDate === dateStr ? acc + 1 : acc;
    }, 0);
  });

  const revenueData = {
    labels: last7Days,
    datasets: [
      {
        label: 'Revenue (₹)',
        data: revenueByDay,
        borderColor: '#f97316', // Primary Orange
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const ordersChartData = {
    labels: last7Days,
    datasets: [
      {
        label: 'Orders',
        data: ordersByDay,
        backgroundColor: '#3b82f6', // Primary Blue
        borderRadius: 4,
      },
    ],
  };

  // Top Products Logic
  const itemCounts: Record<string, number> = {};
  ordersData.forEach(o => {
    (o.items || []).forEach((item: any) => {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
    });
  });
  
  const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topLabels = sortedItems.length > 0 ? sortedItems.map(i => i[0]) : ['No Data'];
  const topData = sortedItems.length > 0 ? sortedItems.map(i => i[1]) : [1];

  const productPerformanceData = {
    labels: topLabels,
    datasets: [{
      data: topData,
      backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444'],
      borderWidth: 0,
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    color: '#cbd5e1', // Secondary text color for ChartJS global
    plugins: {
      legend: { 
        position: 'bottom' as const,
        labels: { color: '#cbd5e1' }
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8' }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8' }
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    color: '#cbd5e1',
    plugins: {
      legend: { position: 'bottom' as const, labels: { color: '#cbd5e1' } },
    },
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 my-8">
      {/* Revenue Line Chart */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-[#1E293B] border border-white/10 shadow-2xl rounded-3xl p-6 h-96 flex flex-col"
      >
        <h3 className="text-lg font-bold text-white mb-4">7-Day Revenue Trend</h3>
        <div className="flex-1 relative">
          {!hasOrders ? (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold">Not Enough Data Yet</div>
          ) : (
            <Line data={revenueData} options={chartOptions} />
          )}
        </div>
      </motion.div>

      {/* Orders Bar Chart */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
        className="bg-[#1E293B] border border-white/10 shadow-2xl rounded-3xl p-6 h-96 flex flex-col"
      >
        <h3 className="text-lg font-bold text-white mb-4">7-Day Order Volume</h3>
        <div className="flex-1 relative">
          {!hasOrders ? (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold">Not Enough Data Yet</div>
          ) : (
            <Bar data={ordersChartData} options={chartOptions} />
          )}
        </div>
      </motion.div>

      {/* Product Performance Doughnut Chart */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
        className="bg-[#1E293B] border border-white/10 shadow-2xl rounded-3xl p-6 h-96 flex flex-col xl:col-span-2"
      >
        <h3 className="text-lg font-bold text-white mb-4">Top Product Performance</h3>
        <div className="flex-1 relative">
          <Doughnut data={productPerformanceData} options={doughnutOptions} />
        </div>
      </motion.div>
    </div>
  );
}
