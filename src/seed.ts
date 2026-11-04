import "dotenv/config";
import { books, getDb } from "./db.js";

const cover = (isbn: string) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
const day = 86_400_000;

const seed = [
  ["Pride and Prejudice", "Jane Austen", "Fiction", "9780141439518", "A sharp, witty story of manners, marriage and misjudged first impressions in Regency England.", 4],
  ["Nineteen Eighty-Four", "George Orwell", "Fiction", "9780451524935", "A chilling look at surveillance, propaganda and the fight to think freely.", 3],
  ["The Hobbit", "J.R.R. Tolkien", "Fiction", "9780547928227", "Bilbo Baggins leaves his quiet hole for a dragon-guarded treasure and an unexpected adventure.", 5],
  ["Cosmos", "Carl Sagan", "Science", "9780345539434", "A poetic tour of the universe, from the first stars to the search for life elsewhere.", 3],
  ["A Brief History of Time", "Stephen Hawking", "Science", "9780553380163", "Black holes, the Big Bang and the nature of time, explained for curious general readers.", 2],
  ["Sapiens", "Yuval Noah Harari", "History", "9780062316110", "How Homo sapiens came to rule the planet, from the cognitive revolution to today.", 4],
  ["The Diary of a Young Girl", "Anne Frank", "History", "9780553296983", "The wartime diary of a teenager in hiding in Amsterdam, full of hope and honesty.", 3],
  ["Matilda", "Roald Dahl", "Kids", "9780142410370", "A brilliant girl with a love of books takes on her awful parents and a terrifying headmistress.", 5],
  ["Charlotte's Web", "E.B. White", "Kids", "9780064400558", "A pig named Wilbur and a clever spider called Charlotte prove how far friendship can go.", 4],
  ["Where the Wild Things Are", "Maurice Sendak", "Kids", "9780060254926", "Max sails to an island of wild creatures and becomes their king.", 2],
] as const;

const col = await books();
if (await col.countDocuments()) {
  console.log("Books already exist, skipping seed.");
} else {
  const now = Date.now();
  await col.insertMany(
    seed.map(([title, author, category, isbn, description, totalCopies], i) => ({
      title,
      author,
      category,
      image: cover(isbn),
      description,
      totalCopies,
      availableCopies: totalCopies,
      userName: "BookNook Library",
      userEmail: "library@booknook.dev",
      createdAt: new Date(now - i * day),
    })),
  );
  console.log(`Seeded ${seed.length} books.`);
}
process.exit(0);
