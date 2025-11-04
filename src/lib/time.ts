import dayjs from "dayjs";
export const now = () => dayjs();
export const daysAgo = (n: number) => now().subtract(n, "day").toDate();

