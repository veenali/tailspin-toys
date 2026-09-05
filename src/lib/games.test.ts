import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getFilteredGames,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedFilterFixtures(db: Database): Promise<void> {
    const [strategy, puzzle] = await db
        .insert(categories)
        .values([
            { name: 'Strategy', description: 'strategy' },
            { name: 'Puzzle', description: 'puzzle' },
        ])
        .returning({ id: categories.id });
    const [codeForge, devMasters] = await db
        .insert(publishers)
        .values([
            { name: 'CodeForge Studios', description: 'code forge' },
            { name: 'DevMasters Inc.', description: 'dev masters' },
        ])
        .returning({ id: publishers.id });

    await db.insert(games).values([
        {
            title: 'Alpha Game',
            description: 'Alpha',
            starRating: 4.2,
            categoryId: strategy.id,
            publisherId: codeForge.id,
        },
        {
            title: 'Beta Game',
            description: 'Beta',
            starRating: 4.2,
            categoryId: puzzle.id,
            publisherId: codeForge.id,
        },
        {
            title: 'Gamma Game',
            description: 'Gamma',
            starRating: 4.2,
            categoryId: strategy.id,
            publisherId: devMasters.id,
        },
    ]);
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('filters games by one or more categories', async () => {
        await seedFilterFixtures(db);
        const strategy = await getFilteredGames(db, { categoryIds: [1] });
        expect(strategy.map((game) => game.title)).toEqual(['Alpha Game', 'Gamma Game']);
    });

    it('filters games by publisher and category together', async () => {
        await seedFilterFixtures(db);
        const filtered = await getFilteredGames(db, { categoryIds: [1], publisherId: 2 });
        expect(filtered.map((game) => game.title)).toEqual(['Gamma Game']);
    });

    it('returns no games when filters have no matches', async () => {
        await seedFilterFixtures(db);
        expect(await getFilteredGames(db, { categoryIds: [99999] })).toEqual([]);
    });
});
