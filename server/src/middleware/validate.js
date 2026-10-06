export function validate(schemas) {
  return async (req, res, next) => {
    try {
      if (schemas.params) {
        const parsedParams = await schemas.params.parseAsync(req.params);
        Object.assign(req.params, parsedParams);
      }
      if (schemas.query) {
        const parsedQuery = await schemas.query.parseAsync(req.query);
        for (const key of Object.keys(req.query)) {
          delete req.query[key];
        }
        Object.assign(req.query, parsedQuery);
      }
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

