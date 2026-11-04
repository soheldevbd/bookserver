import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { ObjectId } from "mongodb";
import { currentUser, verifyJwt } from "./auth.js";
import { books, borrows } from "./db.js";

const router = Router();
const CATEGORIES = ["Fiction", "Science", "History", "Kids", "Others"];

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

const asId = (v: unknown) => (typeof v === "string" && ObjectId.isValid(v) ? new ObjectId(v) : null);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/* ---------------------------- BOOKS ---------------------------- */

// 1. GET /books  (public) — ?q= &category= &email= &limit=
router.get(
  "/books",
  wrap(async (req, res) => {
    const filter: Record<string, unknown> = {};
    const q = str(req.query.q);
    const category = str(req.query.category);
    const email = str(req.query.email);
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ title: rx }, { author: rx }];
    }
    if (category && CATEGORIES.includes(category)) filter.category = category;
    if (email) filter.userEmail = email;

    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "0"), 10) || 0, 0), 100);
    let cursor = (await books()).find(filter).sort({ createdAt: -1 });
    if (limit) cursor = cursor.limit(limit);
    res.json(await cursor.toArray());
  }),
);

// 2. GET /books/:id  (protected)
router.get(
  "/books/:id",
  verifyJwt,
  wrap(async (req, res) => {
    const _id = asId(req.params.id);
    if (!_id) return res.status(400).json({ message: "Invalid book id" });
    const book = await (await books()).findOne({ _id });
    if (!book) return res.status(404).json({ message: "Book not found" });
    res.json(book);
  }),
);

// 3. POST /books  (protected)
router.post(
  "/books",
  verifyJwt,
  wrap(async (req, res) => {
    const user = currentUser(res);
    const { title, author, category, image, description } = req.body ?? {};
    const totalCopies = Number(req.body?.totalCopies);
    if (!str(title) || !str(author) || !str(image) || !str(description)) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (!CATEGORIES.includes(str(category))) {
      return res.status(400).json({ message: "Invalid category" });
    }
    if (!Number.isInteger(totalCopies) || totalCopies < 1 || totalCopies > 1000) {
      return res.status(400).json({ message: "Total copies must be a whole number of at least 1" });
    }
    const doc = {
      title: str(title),
      author: str(author),
      category: str(category),
      image: str(image),
      description: str(description),
      totalCopies,
      availableCopies: totalCopies,
      userName: user.name || str(req.body?.userName),
      userEmail: user.email,
      createdAt: new Date(),
    };
    const result = await (await books()).insertOne(doc);
    res.status(201).json({ insertedId: result.insertedId });
  }),
);

// 4. PATCH /books/:id  (protected, owner only)
router.patch(
  "/books/:id",
  verifyJwt,
  wrap(async (req, res) => {
    const user = currentUser(res);
    const _id = asId(req.params.id);
    if (!_id) return res.status(400).json({ message: "Invalid book id" });
    const col = await books();
    const book = await col.findOne({ _id });
    if (!book) return res.status(404).json({ message: "Book not found" });
    if (book.userEmail !== user.email) {
      return res.status(403).json({ message: "You can only edit your own books" });
    }

    const $set: Record<string, unknown> = {};
    for (const key of ["title", "author", "image", "description"] as const) {
      if (req.body?.[key] !== undefined) {
        if (!str(req.body[key])) return res.status(400).json({ message: `${key} cannot be empty` });
        $set[key] = str(req.body[key]);
      }
    }
    if (req.body?.category !== undefined) {
      if (!CATEGORIES.includes(str(req.body.category))) {
        return res.status(400).json({ message: "Invalid category" });
      }
      $set.category = str(req.body.category);
    }
    if (req.body?.totalCopies !== undefined) {
      const total = Number(req.body.totalCopies);
      const borrowed = book.totalCopies - book.availableCopies;
      if (!Number.isInteger(total) || total < 1 || total > 1000) {
        return res.status(400).json({ message: "Total copies must be a whole number of at least 1" });
      }
      if (total < borrowed) {
        return res.status(400).json({ message: `${borrowed} copies are currently borrowed, total can't be lower` });
      }
      $set.totalCopies = total;
      $set.availableCopies = total - borrowed;
    }
    if (!Object.keys($set).length) return res.status(400).json({ message: "Nothing to update" });

    await col.updateOne({ _id }, { $set });
    res.json({ modifiedCount: 1 });
  }),
);

// 5. DELETE /books/:id  (protected, owner only)
router.delete(
  "/books/:id",
  verifyJwt,
  wrap(async (req, res) => {
    const user = currentUser(res);
    const _id = asId(req.params.id);
    if (!_id) return res.status(400).json({ message: "Invalid book id" });
    const col = await books();
    const book = await col.findOne({ _id });
    if (!book) return res.status(404).json({ message: "Book not found" });
    if (book.userEmail !== user.email) {
      return res.status(403).json({ message: "You can only delete your own books" });
    }
    await col.deleteOne({ _id });
    await (await borrows()).deleteMany({ bookId: String(_id) });
    res.json({ deletedCount: 1 });
  }),
);

/* ---------------------------- BORROWS ---------------------------- */

// 6. POST /borrows  (protected)
router.post(
  "/borrows",
  verifyJwt,
  wrap(async (req, res) => {
    const user = currentUser(res);
    const bookId = asId(req.body?.bookId);
    if (!bookId) return res.status(400).json({ message: "Invalid book id" });

    const returnDate = new Date(req.body?.returnDate);
    const now = new Date();
    const maxDate = new Date(now.getTime() + 30 * 86_400_000);
    if (Number.isNaN(returnDate.getTime()) || returnDate <= now || returnDate > maxDate) {
      return res.status(400).json({ message: "Return date must be within the next 30 days" });
    }

    const bookCol = await books();
    const borrowCol = await borrows();

    // No double borrow
    if (await borrowCol.findOne({ bookId: String(bookId), userEmail: user.email })) {
      return res.status(409).json({ message: "You have already borrowed this book" });
    }

    // Atomically take one copy (only if any are left)
    const book = await bookCol.findOneAndUpdate(
      { _id: bookId, availableCopies: { $gt: 0 } },
      { $inc: { availableCopies: -1 } },
      { returnDocument: "after" },
    );
    if (!book) {
      const exists = await bookCol.findOne({ _id: bookId }, { projection: { _id: 1 } });
      return res
        .status(exists ? 400 : 404)
        .json({ message: exists ? "Sorry, this book is not available right now" : "Book not found" });
    }

    try {
      const result = await borrowCol.insertOne({
        bookId: String(bookId),
        bookTitle: book.title,
        bookImage: book.image,
        userName: user.name,
        userEmail: user.email,
        borrowDate: now,
        returnDate,
      });
      res.status(201).json({ insertedId: result.insertedId });
    } catch (err) {
      await bookCol.updateOne({ _id: bookId }, { $inc: { availableCopies: 1 } }); // roll back
      if ((err as { code?: number }).code === 11000) {
        return res.status(409).json({ message: "You have already borrowed this book" });
      }
      throw err;
    }
  }),
);

// 7. GET /borrows  (protected) — borrows of the logged in user
router.get(
  "/borrows",
  verifyJwt,
  wrap(async (_req, res) => {
    const user = currentUser(res);
    res.json(await (await borrows()).find({ userEmail: user.email }).sort({ borrowDate: -1 }).toArray());
  }),
);

// 8. DELETE /borrows/:id  (protected) — return a book
router.delete(
  "/borrows/:id",
  verifyJwt,
  wrap(async (req, res) => {
    const user = currentUser(res);
    const _id = asId(req.params.id);
    if (!_id) return res.status(400).json({ message: "Invalid borrow id" });
    const borrowCol = await borrows();
    const borrow = await borrowCol.findOne({ _id });
    if (!borrow) return res.status(404).json({ message: "Borrow record not found" });
    if (borrow.userEmail !== user.email) {
      return res.status(403).json({ message: "This borrow does not belong to you" });
    }
    await borrowCol.deleteOne({ _id });
    await (await books()).updateOne({ _id: new ObjectId(borrow.bookId) }, { $inc: { availableCopies: 1 } });
    res.json({ deletedCount: 1 });
  }),
);

export default router;
