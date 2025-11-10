// PostgreSQL error handler middleware
export const errorHandler = (err, req, res, next) => {
  let error = { ...err }
  error.message = err.message

  // Log error in development
  if (process.env.NODE_ENV === "development") {
    console.error("❌ Error Details:", {
      message: err.message,
      code: err.code,
      stack: err.stack,
      constraint: err.constraint,
      table: err.table,
      column: err.column,
    })
  }

  // PostgreSQL duplicate key error (unique constraint violation)
  if (err.code === "23505") {
    const message = "Duplicate field value entered"
    error = {
      message,
      statusCode: 400,
      field: err.constraint,
    }
  }

  // PostgreSQL foreign key constraint violation
  if (err.code === "23503") {
    const message = "Foreign key constraint violation"
    error = {
      message,
      statusCode: 400,
      constraint: err.constraint,
    }
  }

  // PostgreSQL not null constraint violation
  if (err.code === "23502") {
    const message = `Field '${err.column}' is required`
    error = {
      message,
      statusCode: 400,
      field: err.column,
    }
  }

  // PostgreSQL check constraint violation
  if (err.code === "23514") {
    const message = "Check constraint violation"
    error = {
      message,
      statusCode: 400,
      constraint: err.constraint,
    }
  }

  // PostgreSQL invalid data format
  if (err.code === "22P02") {
    const message = "Invalid data format"
    error = {
      message,
      statusCode: 400,
    }
  }

  // PostgreSQL syntax error
  if (err.code === "42601") {
    const message = "SQL syntax error"
    error = {
      message,
      statusCode: 500,
    }
  }

  // PostgreSQL undefined table
  if (err.code === "42P01") {
    const message = "Table does not exist"
    error = {
      message,
      statusCode: 500,
    }
  }

  // PostgreSQL undefined column
  if (err.code === "42703") {
    const message = "Column does not exist"
    error = {
      message,
      statusCode: 500,
    }
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    const message = "Invalid token"
    error = {
      message,
      statusCode: 401,
    }
  }

  if (err.name === "TokenExpiredError") {
    const message = "Token expired"
    error = {
      message,
      statusCode: 401,
    }
  }

  // AI Service errors
  if (err.message && err.message.includes("AI_SERVICE_ERROR")) {
    const message = "AI service temporarily unavailable"
    error = {
      message,
      statusCode: 503,
    }
  }

  // File system errors
  if (err.code === "ENOENT") {
    const message = "File not found"
    error = {
      message,
      statusCode: 404,
    }
  }

  if (err.code === "EACCES") {
    const message = "Permission denied"
    error = {
      message,
      statusCode: 403,
    }
  }

  // Connection errors
  if (err.code === "ECONNREFUSED") {
    const message = "Database connection refused"
    error = {
      message,
      statusCode: 503,
    }
  }

  if (err.code === "ENOTFOUND") {
    const message = "Database host not found"
    error = {
      message,
      statusCode: 503,
    }
  }

  // Default error
  const statusCode = error.statusCode || err.statusCode || 500
  const message = error.message || "Server Error"

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && {
      error: err,
      stack: err.stack,
    }),
  })
}

// 404 handler for undefined routes
export const notFound = (req, res, next) => {
  const error = new Error(`Route ${req.originalUrl} not found`)
  res.status(404).json({
    success: false,
    message: error.message,
  })
}
