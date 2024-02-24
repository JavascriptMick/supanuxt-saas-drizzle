import { drizzle_client } from '~~/drizzle/drizzle.client';
import { eq } from 'drizzle-orm';
import { note, account, type Note } from '~~/drizzle/schema';
import { openai } from './openai.client';
import { AccountLimitError } from './errors';
import { AccountService } from './account.service';

export namespace NotesService {
  export async function getNoteById(id: number) {
    return drizzle_client.select().from(note).where(eq(note.id, id));
  }

  export async function getNotesForAccountId(account_id: number) {
    return drizzle_client
      .select()
      .from(note)
      .where(eq(note.account_id, account_id));
  }

  export async function createNote(account_id: number, note_text: string) {
    const this_account = await drizzle_client.query.account.findFirst({
      where: eq(account.id, account_id),
      with: {
        notes: true
      }
    });

    if (!this_account) {
      throw new Error('Account not found');
    }

    if (this_account.notes.length >= this_account.max_notes) {
      throw new AccountLimitError(
        'Note Limit reached, no new notes can be added'
      );
    }

    const insertedNotes = await drizzle_client
      .insert(note)
      .values({ account_id, note_text })
      .returning();

    return insertedNotes[0] as Note;
  }

  export async function updateNote(id: number, note_text: string) {
    const updatedNotes = await drizzle_client
      .update(note)
      .set({ note_text })
      .where(eq(note.id, id));

    return updatedNotes[0] as Note;
  }

  export async function deleteNote(id: number) {
    const deletedNotes = await drizzle_client
      .delete(note)
      .where(eq(note.id, id))
      .returning();

    return deletedNotes[0] as Note;
  }

  export async function generateAINoteFromPrompt(
    userPrompt: string,
    account_id: number
  ) {
    const account = await AccountService.checkAIGenCount(account_id);

    const prompt = `
    Write an interesting short note about ${userPrompt}.
    Restrict the note to a single paragraph.
    `;
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      stop: '\n\n',
      max_tokens: 1000,
      n: 1
    });

    await AccountService.incrementAIGenCount(account);

    return completion.choices?.[0]?.message.content?.trim();
  }
}
