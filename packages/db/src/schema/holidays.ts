import { pgTable, text, date, integer } from 'drizzle-orm/pg-core';

export const holidays = pgTable('holidays', {
  date: date('date').primaryKey(),
  name: text('name').notNull(),
  year: integer('year').notNull(),
});
