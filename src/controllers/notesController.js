import createHttpError from 'http-errors';
import { Note } from '../models/note.js';

// GET /notes
export const getAllNotes = async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const perPage = Number(req.query.perPage ?? 10);
    const { tag, search } = req.query;

    const filter = {};
    if (tag) filter.tag = tag;
    if (search !== undefined && search.trim() !== '') {
      filter.$text = { $search: search };
    }

    const skip = (page - 1) * perPage;

    const [totalNotes, notes] = await Promise.all([
      Note.countDocuments(filter),
      Note.find(filter).skip(skip).limit(perPage),
    ]);

    const totalPages = Math.ceil(totalNotes / perPage) || 1;

    res.status(200).json({
      page,
      perPage,
      totalNotes,
      totalPages,
      notes,
    });
  } catch (err) {
    next(err);
  }
};

// GET /notes/:noteId
export const getNoteById = async (req, res, next) => {
  try {
    const { noteId } = req.params;

    const note = await Note.findById(noteId);

    if (!note) {
      return next(createHttpError(404, 'Note not found'));
    }

    res.status(200).json(note);
  } catch (err) {
    next(err);
  }
};

// POST /notes
export const createNote = async (req, res, next) => {
  try {
    const created = await Note.create(req.body);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
};

// PATCH /notes/:noteId
export const updateNote = async (req, res, next) => {
  try {
    const { noteId } = req.params;

    const updated = await Note.findByIdAndUpdate(noteId, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return next(createHttpError(404, 'Note not found'));
    }

    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};

// DELETE /notes/:noteId
export const deleteNote = async (req, res, next) => {
  try {
    const { noteId } = req.params;

    const deleted = await Note.findByIdAndDelete(noteId);

    if (!deleted) {
      return next(createHttpError(404, 'Note not found'));
    }

    res.status(200).json(deleted);
  } catch (err) {
    next(err);
  }
};
