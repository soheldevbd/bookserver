import { MongoClient, type Db, type ObjectId } from 'mongodb';

export interface Book {
  _id?: ObjectId;
  title: string;
  author: string;
  category: string;
  image: string;
  description: string;
  totalCopies: number;
  availableCopies: number;
  userName: string;
  userEmail: string;
  createdAt: Date;
}

export interface Borrow {
  _id?: ObjectId;
  bookId: string;
  bookTitle: string;
  bookImage: string;
  userName: string;
  userEmail: string;
  borrowDate: Date;
  returnDate: Date;
}

let dbPromise: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  if (!dbPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not set');
    dbPromise = new MongoClient(uri)
      .connect()
      .then(async client => {
        const db = client.db(process.env.MONGODB_DB || 'booknook');
        await db.collection('books').createIndex({ createdAt: -1 });
        // One active borrow per user per book (blocks double borrow even under race conditions)
        await db
          .collection('borrows')
          .createIndex({ bookId: 1, userEmail: 1 }, { unique: true });
        return db;
      })
      .catch(err => {
        dbPromise = null;
        throw err;
      });
  }
  return dbPromise;
}

export const books = async () => (await getDb()).collection<Book>('books');
export const borrows = async () =>
  (await getDb()).collection<Borrow>('borrows');
