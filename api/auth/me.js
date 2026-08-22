const {
  getCurrentUser,
} = require("../_lib/auth");

module.exports = async function handler(
  req,
  res
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const user = await getCurrentUser(req);

    if (!user) {
      return res.status(401).json({
        authenticated: false,
        user: null,
      });
    }

    return res.status(200).json({
      authenticated: true,
      user,
    });
  } catch (error) {
    console.error(
      "[web-auth/me]",
      error
    );

    return res.status(500).json({
      error: "Unable to verify session",
    });
  }
};