const jwt = require('jsonwebtoken')
const { query } = require('../database/dbpromise')

const validateUser = async (req, res, next) => {
    try {
        const token = req.get('Authorization')
        if (!token) {
            return res.json({ msg: "No token found", token: token, logout: true })
        }

        // Promisify jwt.verify to handle it properly with async/await
        const decode = await new Promise((resolve, reject) => {
            jwt.verify(token.split(' ')[1], process.env.JWTKEY, (err, decoded) => {
                if (err) reject(err);
                else resolve(decoded);
            });
        });

        const getUser = await query(`SELECT * FROM user WHERE email = ? AND password = ?`, [
            decode.email, decode.password || null
        ]);

        if (getUser.length < 1) {
            return res.json({
                success: false,
                msg: "Invalid token found",
                token,
                logout: true
            });
        }

        if (getUser[0].role === 'user' || getUser[0].role === 'admin') {
            req.decode = decode;
            req.user = getUser[0];
            next();
        } else {
            return res.json({
                success: 0,
                msg: "Unauthorized token",
                token: token,
                logout: true
            });
        }

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

module.exports = validateUser