import { createStudentHandler } from '../lib/handler.js';

export const POST = createStudentHandler();

export default async function handler(request) {
  return POST(request);
}
