const cmsService = require("../services/cmsService");

function sendError(res, error) {
  const status = error.status || 500;
  const message = error.message || "Internal Server Error";
  return res.status(status).json({ message });
}

function buildListHandler(resource) {
  return async (req, res) => {
    try {
      const data = await cmsService.list(resource, { userId: req.query.user_id });
      return res.status(200).json(data);
    } catch (error) {
      return sendError(res, error);
    }
  };
}

function buildGetByIdHandler(resource) {
  return async (req, res) => {
    try {
      const data = await cmsService.getById(resource, req.params.id);
      return res.status(200).json(data);
    } catch (error) {
      return sendError(res, error);
    }
  };
}

function buildUpsertHandler(resource, label) {
  return async (req, res) => {
    try {
      const result = await cmsService.upsertByUser(resource, req.body);
      return res.status(result.created ? 201 : 200).json({
        message: `${label} CMS ${result.created ? "created" : "updated"} successfully`,
        data: result.doc,
      });
    } catch (error) {
      return sendError(res, error);
    }
  };
}

function buildPatchHandler(resource, label) {
  return async (req, res) => {
    try {
      const data = await cmsService.patchById(resource, req.params.id, req.body);
      return res.status(200).json({ message: `${label} CMS updated successfully`, data });
    } catch (error) {
      return sendError(res, error);
    }
  };
}

function buildPutHandler(resource, label) {
  return async (req, res) => {
    try {
      const data = await cmsService.putById(resource, req.params.id, req.body);
      return res.status(200).json({ message: `${label} CMS updated successfully`, data });
    } catch (error) {
      return sendError(res, error);
    }
  };
}

function buildDeleteHandler(resource, label) {
  return async (req, res) => {
    try {
      await cmsService.removeById(resource, req.params.id);
      return res.status(200).json({ message: `${label} CMS deleted successfully` });
    } catch (error) {
      return sendError(res, error);
    }
  };
}

module.exports = {
  listHome: buildListHandler("home"),
  getHomeById: buildGetByIdHandler("home"),
  upsertHome: buildUpsertHandler("home", "Home"),
  patchHome: buildPatchHandler("home", "Home"),
  putHome: buildPutHandler("home", "Home"),
  deleteHome: buildDeleteHandler("home", "Home"),

  listHeader: buildListHandler("header"),
  getHeaderById: buildGetByIdHandler("header"),
  upsertHeader: buildUpsertHandler("header", "Header"),
  patchHeader: buildPatchHandler("header", "Header"),
  putHeader: buildPutHandler("header", "Header"),
  deleteHeader: buildDeleteHandler("header", "Header"),

  listIndex: buildListHandler("index"),
  getIndexById: buildGetByIdHandler("index"),
  upsertIndex: buildUpsertHandler("index", "Index"),
  patchIndex: buildPatchHandler("index", "Index"),
  putIndex: buildPutHandler("index", "Index"),
  deleteIndex: buildDeleteHandler("index", "Index"),
};
