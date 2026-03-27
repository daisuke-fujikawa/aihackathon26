import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// サンプルテーブル - テーマに合わせて変更してください
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
