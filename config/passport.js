const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

module.exports = function(passport) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: '/api/auth/google/callback'
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    const email = profile.emails?.[0]?.value;

                    if (!email) {
                        return done(new Error('Google account did not provide an email address'), null);
                    }

                    let user = await User.findOne({ email: email.toLowerCase() });

                    if (user) {
                        return done(null, user);
                    }

                    const emailPrefix = email.split('@')[0];
                    const collegeId = emailPrefix
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, '')
                        .substring(0, 10) + Date.now().toString().slice(-4);

                    user = await User.create({
                        name: profile.displayName,
                        email: email.toLowerCase(),
                        collegeId,
                        password: 'google-oauth-' + Math.random().toString(36).substring(7),
                        role: 'student',
                        googleId: profile.id,
                        avatar: profile.photos?.[0]?.value,
                        isActive: true,
                        emailVerified: true
                    });

                    done(null, user);
                } catch (error) {
                    console.error('Google OAuth Error:', error);
                    done(error, null);
                }
            }
        )
    );

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    });
};
