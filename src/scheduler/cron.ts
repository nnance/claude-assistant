import { CronExpressionParser } from 'cron-parser'

export function computeNextRun(cronExpr: string, after?: Date): Date {
  const interval = CronExpressionParser.parse(cronExpr, {
    currentDate: after ?? new Date(),
  })
  return interval.next().toDate()
}
