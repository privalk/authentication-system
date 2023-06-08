const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const axios = require('axios');

const app = express();
const port = 3000;

const jwt = require('jsonwebtoken');

function generateAuthToken(userId, secretKey, expiresIn = '1h') {
    const payload = { userId };
    const options = { expiresIn };

    return jwt.sign(payload, secretKey, options);
}

//连接 MySQL 
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'gintama2001',
    database: 'test'
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL database: ', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// 中间件
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));

// 路由
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html');
});

app.get('/register', (req, res) => {
    res.sendFile(__dirname + '/views/register.html');
});

app.get('/manage', (req, res) => {
    res.sendFile(__dirname + '/views/manage.html');
});
let verificationCode = '';
function generateVerificationCode() {
    const codeLength = 6; // 验证码长度
    verificationCode = '';

    for (let i = 0; i < codeLength; i++) {
        const digit = Math.floor(Math.random() * 10); // 生成随机数字
        verificationCode += digit.toString();
    }

    return verificationCode;
}


// 创建一个邮件传输对象
const transporter = nodemailer.createTransport({
    host: 'smtp.qq.com',
    secureConnection: true, 
    port: 465,
    secure: true, 
    auth: {
        user: '291863911@qq.com',
        pass: 'veciyzvjayuhcaeh' 
    }
});

function sendVerificationCodeToEmail(email, code) {
    const mailOptions = {
        from: '291863911@qq.com', // 发件人邮箱
        to: email, // 收件人邮箱
        subject: '验证码', // 邮件主题
        text: `您的验证码是：${code}` // 邮件正文
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('发送邮件失败:', error);
        } else {
            console.log('邮件已发送:', info.response);
        }
    });
}


const SMSClient = require('@alicloud/sms-sdk');

// 阿里云短信服务配置
const accessKeyId = 'LTAI5tSRp1m9Yd4BFRbhFk11';
const secretAccessKey = 'DHlKO99DnTDZgLBZYLD0zngTWVMLZ9';
const smsClient = new SMSClient({ accessKeyId, secretAccessKey });


function sendVerificationCodeToPhoneNumber(phoneNumber, verificationCode) {
    const params = {
        PhoneNumbers: phoneNumber,
        SignName: 'ppiiko', // 短信签名
        TemplateCode: 'SMS_460935807', // 短信模板CODE
        TemplateParam: `{"code": "${verificationCode}"}` // 短信模板变量
    };

    smsClient.sendSMS(params)
        .then(response => {
            console.log('短信发送成功', response);
        })
        .catch(error => {
            console.error('短信发送失败', error);
        });
}



app.post('/send-verification-code', (req, res) => {
    const { email, phoneNumber } = req.body;
    const code = generateVerificationCode(); // 生成验证码

    if (email) {
        sendVerificationCodeToEmail(email, code);
        res.send('验证码已发送到邮箱');
    } else if (phoneNumber) {
        sendVerificationCodeToPhoneNumber(phoneNumber, code);
        res.send('验证码已发送到手机');
    } else {
        res.status(400).send('未提供邮箱或手机号');
    }
});
app.post('/login/password', (req, res) => {
    const { username, password } = req.body;

    
    const query = 'SELECT * FROM users WHERE username = ?';
    db.query(query, [username], (err, results) => {
        if (err) {
            console.error('Error retrieving user data:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        if (results.length === 0) {
            res.status(401).json({ error: 'Invalid username or password' });
            return;
        }

        const user = results[0];

        // 哈希
        const hashedPassword = crypto.pbkdf2Sync(
            password,
            user.salt,
            10000,
            64,
            'sha256'
        ).toString('hex');

        //比对
        if (hashedPassword === user.password) {
            res.redirect('/login/success');

        } else {
            res.status(401).json({ error: 'Invalid username or password' });
        }
    });
});


app.post('/login/verification', (req, res) => {
    const { username, code } = req.body;

    const query = 'SELECT * FROM users WHERE username = ?';
    db.query(query, [username], (err, results) => {
        if (err) {
            console.error('Error retrieving user data:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        if (results.length === 0) {
            res.status(401).json({ error: 'Invalid username or verification code' });
            return;
        }

        const user = results[0];

    
        if (code === verificationCode) {
            res.redirect('/login/success');
        } else {
            res.status(401).json({ error: 'Invalid username or verification code' });
        }
    });
});

app.get('/login/success', (req, res) => {
    // 在这里处理登录成功页面的逻辑
    res.send('登录成功页面'); // 替换为实际的登录成功页面的代码或模板
});


app.post('/register', (req, res) => {
    const { username, password, email, phone } = req.body;

    const query = 'SELECT * FROM users WHERE username = ?';
    db.query(query, [username], (err, results) => {
        if (err) {
            console.error('Error checking username availability:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        if (results.length > 0) {
            res.status(400).json({ error: 'Username is already taken' });
            return;
        }

        // 生成随机盐值
        const salt = crypto.randomBytes(16).toString('hex');

        // 哈希
        const hashedPassword = crypto.pbkdf2Sync(
            password,
            salt,
            10000,
            64,
            'sha256'
        ).toString('hex');

    
        const insertQuery = 'INSERT INTO users (username, password, salt, email, phone) VALUES (?, ?, ?, ?, ?)';
        db.query(insertQuery, [username, hashedPassword, salt, email, phone], (err) => {
            if (err) {
                console.error('Error inserting user data:', err);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            res.status(201).json({ message: 'User registered successfully' });
        });
    });
});


app.get('/users', (req, res) => {

    const query = 'SELECT * FROM users';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error retrieving users:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        res.json(results);
    });
});


app.get('/users/:id', (req, res) => {
    const userId = req.params.id;

    // Fetch user data from the database based on the provided user ID
    const query = 'SELECT * FROM users WHERE id = ?';
    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Error retrieving user data:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        if (results.length === 0) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const user = results[0];

        res.json(user);
    });
});


app.post('/users', (req, res) => {
    const { username, password, email, phone } = req.body;


    const query = 'SELECT * FROM users WHERE username = ?';
    db.query(query, [username], (err, results) => {
        if (err) {
            console.error('Error checking username availability:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        if (results.length > 0) {
            res.status(400).json({ error: 'Username is already taken' });
            return;
        }

    
        const salt = crypto.randomBytes(16).toString('hex');

      
        const hashedPassword = crypto.pbkdf2Sync(
            password,
            salt,
            10000,
            64,
            'sha256'
        ).toString('hex');

    
        const insertQuery = 'INSERT INTO users (username, password, salt, email, phone) VALUES (?, ?, ?, ?, ?)';
        db.query(insertQuery, [username, hashedPassword, salt, email, phone], (err, result) => {
            if (err) {
                console.error('Error inserting user data:', err);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            const insertedUserId = result.insertId;
            const insertedUserQuery = 'SELECT * FROM users WHERE id = ?';
            db.query(insertedUserQuery, [insertedUserId], (err, insertedUser) => {
                if (err) {
                    console.error('Error retrieving inserted user data:', err);
                    res.status(500).json({ error: 'Internal Server Error' });
                    return;
                }

                res.status(201).json({ message: 'User registered successfully', user: insertedUser[0] });
            });
        });
    });
});


app.put('/users/:id', (req, res) => {
    const userId = req.params.id;
    const { username, password, email, phone } = req.body;


    const query = 'SELECT * FROM users WHERE id = ?';
    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Error retrieving user data:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        if (results.length === 0) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const user = results[0];

       
        user.username = username || user.username;
        user.email = email || user.email;
        user.phone = phone || user.phone;

        if (password) {
            
            const salt = crypto.randomBytes(16).toString('hex');

          
            const hashedPassword = crypto.pbkdf2Sync(
                password,
                salt,
                10000,
                64,
                'sha256'
            ).toString('hex');

            user.password = hashedPassword;
            user.salt = salt;
        }

    
        const updateQuery = 'UPDATE users SET username = ?, password = ?, salt = ?, email = ?, phone = ? WHERE id = ?';
        db.query(
            updateQuery,
            [user.username, user.password, user.salt, user.email, user.phone, userId],
            (err) => {
                if (err) {
                    console.error('Error updating user data:', err);
                    res.status(500).json({ error: 'Internal Server Error' });
                    return;
                }

                res.json({ message: 'User updated successfully' });
            }
        );
    });
});


app.delete('/users/:id', (req, res) => {
    const userId = req.params.id;


    const query = 'SELECT * FROM users WHERE id = ?';
    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Error retrieving user data:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        if (results.length === 0) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

  
        const deleteQuery = 'DELETE FROM users WHERE id = ?';
        db.query(deleteQuery, [userId], (err) => {
            if (err) {
                console.error('Error deleting user:', err);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            res.json({ message: 'User deleted successfully' });
        });
    });
});



app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
