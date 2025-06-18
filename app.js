import express from 'express'
import session from 'express-session'
import passport from 'passport'
import GitLabStrategy from 'passport-gitlab2'
import dotenv from 'dotenv'
import webhookRouter from './routes/webhook.js'

dotenv.config()

const app = express()
app.set('trust proxy', 1)

// parse request bodies
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Session config
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}))

// initialixe the passport
app.use(passport.initialize())
app.use(passport.session())

// configure GitLab Strategy
passport.use(new GitLabStrategy({
  baseURL: 'https://gitlab.lnu.se',
  clientID: process.env.GITLAB_CLIENT_ID,
  clientSecret: process.env.GITLAB_CLIENT_SECRET,
  callbackURL: process.env.GITLAB_CALLBACK_URL
}, (accessToken, refreshToken, profile, done) => {
  profile.accessToken = accessToken // Store it in the user profile
  return done(null, profile)
}))

// Serialize and deserialize user
passport.serializeUser((user, done) => {
  done(null, user)
})
passport.deserializeUser((obj, done) => {
  done(null, obj)
})

// les routes for oauth logging and callback and redirects to webhook page after auth
app.get('/auth/gitlab',
  passport.authenticate('gitlab', { scope: ['api'] })
)

app.get('/auth/gitlab/callback',
  passport.authenticate('gitlab', { failureRedirect: '/' }),
  (req, res) => {
    // Successful authentication
    res.redirect('/webhook')
  }
)

/**
 * Middleware to ensure the user is authenticated before allowing access to the route.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 * @returns {void}
 */
function ensureAuthenticated (req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }
  res.redirect('/auth/gitlab')
}

// appluing auth middleware to the webhook route
const clients = []

app.use('/webhook', ensureAuthenticated, webhookRouter(clients))

// serve static files
app.use(express.static('public'))

// start the server
const PORT = process.env.PORT || 3000
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack || err)
  res.status(500).send('Something broke!')
})
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
