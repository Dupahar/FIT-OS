// ─── Demo Data for Analytics Page ─────────────────────────
// All data is generated programmatically with realistic Indian gym business numbers

export interface MonthlyRevenueData {
  month: string
  invoiced: number
  collected: number
  collectionRate: number
}

export interface PlanRevenueData {
  month: string
  monthlyPro: number
  quarterly: number
  annual: number
  walkIn: number
}

export interface MemberGrowthData {
  month: string
  newEnrollments: number
  churned: number
  netChange: number
  totalActive: number
}

export interface WhatsAppCampaign {
  name: string
  sent: number
  delivered: number
  converted: number
  period: string
}

// Monthly Revenue (Jan 2025 → Mar 2026) with ~12-15% month-on-month growth
export const monthlyRevenueData: MonthlyRevenueData[] = [
  { month: 'Jan 25', invoiced: 180000, collected: 127800, collectionRate: 71 },
  { month: 'Feb 25', invoiced: 198000, collected: 142560, collectionRate: 72 },
  { month: 'Mar 25', invoiced: 221000, collected: 161930, collectionRate: 73 },
  { month: 'Apr 25', invoiced: 245000, collected: 183750, collectionRate: 75 },
  { month: 'May 25', invoiced: 268000, collected: 204680, collectionRate: 76 },
  { month: 'Jun 25', invoiced: 295000, collected: 230100, collectionRate: 78 },
  { month: 'Jul 25', invoiced: 318000, collected: 254400, collectionRate: 80 },
  { month: 'Aug 25', invoiced: 342000, collected: 283860, collectionRate: 83 },
  // WhatsApp automation enabled from Sep 2025
  { month: 'Sep 25', invoiced: 375000, collected: 337500, collectionRate: 90 },
  { month: 'Oct 25', invoiced: 410000, collected: 372100, collectionRate: 91 },
  { month: 'Nov 25', invoiced: 438000, collected: 394200, collectionRate: 90 },
  { month: 'Dec 25', invoiced: 462000, collected: 420420, collectionRate: 91 },
  { month: 'Jan 26', invoiced: 495000, collected: 455400, collectionRate: 92 },
  { month: 'Feb 26', invoiced: 528000, collected: 480480, collectionRate: 91 },
  { month: 'Mar 26', invoiced: 562000, collected: 517040, collectionRate: 92 },
]

// Revenue by Plan split per month (last 6 months)
export const planRevenueData: PlanRevenueData[] = [
  { month: 'Oct 25', monthlyPro: 164000, quarterly: 123000, annual: 82000, walkIn: 41000 },
  { month: 'Nov 25', monthlyPro: 175200, quarterly: 131400, annual: 87600, walkIn: 43800 },
  { month: 'Dec 25', monthlyPro: 184800, quarterly: 138600, annual: 92400, walkIn: 46200 },
  { month: 'Jan 26', monthlyPro: 198000, quarterly: 148500, annual: 99000, walkIn: 49500 },
  { month: 'Feb 26', monthlyPro: 211200, quarterly: 158400, annual: 105600, walkIn: 52800 },
  { month: 'Mar 26', monthlyPro: 224800, quarterly: 168600, annual: 112400, walkIn: 56200 },
]

// Member Growth (Jan 2025 → Mar 2026)
export const memberGrowthData: MemberGrowthData[] = [
  { month: 'Jan 25', newEnrollments: 18, churned: 8, netChange: 10, totalActive: 180 },
  { month: 'Feb 25', newEnrollments: 22, churned: 10, netChange: 12, totalActive: 192 },
  { month: 'Mar 25', newEnrollments: 25, churned: 11, netChange: 14, totalActive: 206 },
  { month: 'Apr 25', newEnrollments: 20, churned: 9, netChange: 11, totalActive: 217 },
  { month: 'May 25', newEnrollments: 28, churned: 12, netChange: 16, totalActive: 233 },
  { month: 'Jun 25', newEnrollments: 24, churned: 10, netChange: 14, totalActive: 247 },
  { month: 'Jul 25', newEnrollments: 26, churned: 13, netChange: 13, totalActive: 260 },
  { month: 'Aug 25', newEnrollments: 30, churned: 14, netChange: 16, totalActive: 276 },
  { month: 'Sep 25', newEnrollments: 27, churned: 11, netChange: 16, totalActive: 292 },
  { month: 'Oct 25', newEnrollments: 32, churned: 15, netChange: 17, totalActive: 309 },
  { month: 'Nov 25', newEnrollments: 22, churned: 9, netChange: 13, totalActive: 322 },
  { month: 'Dec 25', newEnrollments: 19, churned: 12, netChange: 7, totalActive: 329 },
  { month: 'Jan 26', newEnrollments: 25, churned: 10, netChange: 15, totalActive: 334 },
  { month: 'Feb 26', newEnrollments: 21, churned: 13, netChange: 8, totalActive: 339 },
  { month: 'Mar 26', newEnrollments: 23, churned: 15, netChange: 8, totalActive: 347 },
]

// Churn Risk Distribution
export const churnRiskData = [
  { name: 'Low Risk', value: 68, count: 236, color: '#00B894' },
  { name: 'Medium Risk', value: 24, count: 83, color: '#F39C12' },
  { name: 'High Risk', value: 8, count: 28, color: '#E74C3C' },
]

export const riskTiers = [
  { level: 'High', criteria: '>14 days absent OR payment failed', color: '#E74C3C' },
  { level: 'Medium', criteria: '7-14 days absent OR renewal within 7 days', color: '#F39C12' },
  { level: 'Low', criteria: 'Active attendance, payments current', color: '#00B894' },
]

// Peak Hours Heatmap (7 rows × 16 columns: Mon-Sun × 6am-9pm)
function generateHeatmapData(): number[][] {
  const data: number[][] = []
  const hours = Array.from({ length: 16 }, (_, i) => i + 6) // 6am to 9pm

  for (let day = 0; day < 7; day++) {
    const row: number[] = []
    const isWeekend = day >= 5

    for (const hour of hours) {
      let base = 15

      if (isWeekend) {
        // Weekend pattern: peak 10am-12pm
        if (hour >= 10 && hour <= 12) base = 70 + Math.floor(Math.random() * 15)
        else if (hour >= 8 && hour <= 14) base = 40 + Math.floor(Math.random() * 15)
        else base = 10 + Math.floor(Math.random() * 15)
      } else {
        // Weekday pattern: peaks at 6-8am and 6-8pm
        if (hour >= 6 && hour <= 8) base = 80 + Math.floor(Math.random() * 20)
        else if (hour >= 18 && hour <= 20) base = 85 + Math.floor(Math.random() * 10)
        else if (hour >= 9 && hour <= 11) base = 35 + Math.floor(Math.random() * 15)
        else if (hour >= 14 && hour <= 16) base = 20 + Math.floor(Math.random() * 15)
        else base = 10 + Math.floor(Math.random() * 15)
      }

      row.push(Math.min(100, Math.max(0, base)))
    }
    data.push(row)
  }
  return data
}

export const peakHoursData = generateHeatmapData()
export const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const hourLabels = Array.from({ length: 16 }, (_, i) => {
  const h = i + 6
  return h <= 12 ? `${h}am` : `${h - 12}pm`
})

// WhatsApp Campaign Performance
export const whatsappCampaigns: WhatsAppCampaign[] = [
  { name: 'March Renewal Batch', sent: 34, delivered: 31, converted: 28, period: 'Mar 2026' },
  { name: 'Feb Expiry Reminder', sent: 28, delivered: 27, converted: 24, period: 'Feb 2026' },
  { name: 'Jan Retention Drive', sent: 45, delivered: 43, converted: 31, period: 'Jan 2026' },
  { name: 'Dec Payment Reminder', sent: 19, delivered: 18, converted: 16, period: 'Dec 2025' },
  { name: 'Nov Re-engagement', sent: 52, delivered: 49, converted: 29, period: 'Nov 2025' },
]

// Collection Efficiency Over Time
export const collectionEfficiencyData = monthlyRevenueData.map((d) => ({
  month: d.month,
  rate: d.collectionRate,
  isAfterWA: monthlyRevenueData.indexOf(d) >= 8,
}))

// GST Compliance Summary (demo)
export const gstSummary = {
  totalTaxableSupply: 56200000, // paise
  cgstCollected: 5058000,
  sgstCollected: 5058000,
  totalGstLiability: 10116000,
}

// Retention metrics
export const retentionMetrics = {
  retentionRate: 91.2,
  industryAverage: 68,
  avgVisitsPerWeek: 3.4,
  paymentOnTime: 94,
  membersEngagedWhatsApp: 287,
  projectedMRR: 31240000, // paise = ₹3,12,400
  newEnrollmentsPipeline: 8,
}
