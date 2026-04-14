const { RegisteradminModal } = require("../models/AdminModel/RegisterAdminModel");
const HeaderCMS = require("../models/CMS/HeaderCMS");
const HomeCMS = require("../models/CMS/HomeCMS");
const IndexCMS = require("../models/CMS/IndexCMS");

const RESOURCE_MODELS = {
  home: HomeCMS,
  header: HeaderCMS,
  index: IndexCMS,
};

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getModel(resource) {
  const model = RESOURCE_MODELS[resource];
  if (!model) {
    throw createHttpError(400, `Unsupported CMS resource: ${resource}`);
  }
  return model;
}

function sanitizePayload(payload = {}) {
  const sanitized = { ...payload };
  delete sanitized._id;
  delete sanitized.createdAt;
  delete sanitized.updatedAt;
  return sanitized;
}

async function list(resource, options = {}) {
  const Model = getModel(resource);
  const query = {};

  if (options.userId) {
    query.user_id = options.userId;
  }

  return Model.find(query).sort({ updatedAt: -1, _id: -1 });
}

async function getById(resource, id) {
  const Model = getModel(resource);
  const doc = await Model.findById(id);

  if (!doc) {
    throw createHttpError(404, `${resource} CMS entry not found`);
  }

  return doc;
}

async function upsertByUser(resource, payload) {
  const Model = getModel(resource);
  const sanitized = sanitizePayload(payload);

  if (!sanitized.user_id) {
    throw createHttpError(400, "user_id is required");
  }

  const existing = await Model.findOne({ user_id: sanitized.user_id });
  if (existing) {
    existing.set(sanitized);
    const updated = await existing.save();
    return { doc: updated, created: false };
  }

  const created = await Model.create(sanitized);

  if (resource === "index") {
    await RegisteradminModal.findByIdAndUpdate(
      sanitized.user_id,
      { $addToSet: { indexCMS: created._id } },
      { new: true }
    );
  }

  return { doc: created, created: true };
}

async function patchById(resource, id, payload) {
  const Model = getModel(resource);
  const sanitized = sanitizePayload(payload);

  const updated = await Model.findByIdAndUpdate(
    id,
    { $set: sanitized },
    { new: true, runValidators: true }
  );

  if (!updated) {
    throw createHttpError(404, `${resource} CMS entry not found`);
  }

  return updated;
}

async function putById(resource, id, payload) {
  const Model = getModel(resource);
  const sanitized = sanitizePayload(payload);

  const existing = await Model.findById(id);
  if (!existing) {
    throw createHttpError(404, `${resource} CMS entry not found`);
  }

  if (!sanitized.user_id) {
    sanitized.user_id = existing.user_id;
  }

  existing.set(sanitized);
  const updated = await existing.save();
  return updated;
}

async function removeById(resource, id) {
  const Model = getModel(resource);
  const deleted = await Model.findByIdAndDelete(id);

  if (!deleted) {
    throw createHttpError(404, `${resource} CMS entry not found`);
  }

  return deleted;
}

module.exports = {
  list,
  getById,
  upsertByUser,
  patchById,
  putById,
  removeById,
};
