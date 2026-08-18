import cron from 'node-cron';
import { weeklyReportService } from '../lib/services/WeeklyReportService.js';

export class WeeklyReportJob {
  private static isScheduled = false;

  public static initCronJob() {
    if (this.isScheduled) return;
    this.isScheduled = true;

    // Run every Monday at 00:05 AM to generate previous week's report
    cron.schedule('5 0 * * 1', async () => {
      console.log('⏰ [WeeklyReportJob] Automated Monday 00:05 AM weekly report cron triggered.');
      try {
        const result = await weeklyReportService.generateAndProcessReport();
        console.log(`✅ [WeeklyReportJob] Weekly report generated successfully: ${result.weekLabel}`);
      } catch (err: any) {
        console.error('❌ [WeeklyReportJob] Automated weekly report failed:', err.message);
      }
    });

    console.log('⏰ [WeeklyReportJob] Scheduled to run automatically every Monday at 00:05 AM.');
  }
}

export const weeklyReportJob = WeeklyReportJob;
