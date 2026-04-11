export default function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  if (err.code === 'ENOENT') {
    return res.status(404).json({
      error: 'Not Found',
      message: 'The requested file or directory does not exist.',
    });
  }

  if (err.code === 'EACCES') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Permission denied.',
    });
  }

  if (err.code === 'EEXIST') {
    return res.status(409).json({
      error: 'Conflict',
      message: 'A file or directory with that name already exists.',
    });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred.',
  });
}
