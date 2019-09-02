
const firebase = require('firebase');
const admin = require('firebase-admin');
const storage = admin.storage();
const db = firebase.firestore();




let token, userId;
exports.signUp = (req, res) => {
    console.log(db);
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle
    };
    let validateUser = validateNewUser(newUser);
    if (Object.keys(validateUser).length > 0) {
        return res.status(400).json(validateUser);
    }
    db.doc(`/users/${newUser.handle}`).get()
        .then((doc) => {
            if (doc.exists) {
                return res.status(400).json({ handle: 'Este usuario ya existe' })
            } else {
                return auth.createUserWithEmailAndPassword(newUser.email, newUser.password);
            }

        }).then((data) => {
            userId = data.user.uid;
            return data.user.getIdToken();
        }).then((tokenCode) => {
            token = tokenCode;
            const userCredentials = {
                handle: newUser.handle,
                email: newUser.email,
                createdAt: new Date().toISOString(),
                userId
            }
            return db.doc(`/users/${newUser.handle}`).set(userCredentials);

        }).then(() => {
            return res.status(201).json({ token });
        })
        .catch((err) => {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') {
                return res.status(400).json({ email: "Ya existe usuario con este correo" });
            } else {
                return res.status(500).json({ general: 'Algo salio mal, favor intentar nuevamente' });
            }

        });
};

exports.login = (req, res) => {
    const user = {
        email: req.body.email,
        password: req.body.password
    }
    if (!validateLogin(user)) {
        return res.status(400).json({ error: 'Usuario y/o contraseña no deben estar vacios.' })
    }

    auth().signInWithEmailAndPassword(user.email, user.password)
        .then((data) => {
            return data.user.getIdToken();
        }).then((token) => {
            return res.json(token);
        }).catch((err) => {
            console.error(err);
            if (err.code === 'auth/wrong-password') {
                return res.status(403).json({ general: 'La password ingresada no es correcta' });
            }
            return res.status(500).json({ error: err.code })

        })

}

exports.fbAuth = (req, res, next) => {
    let idToken;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        idToken = req.headers.authorization.split('Bearer ')[1];
    } else {
        console.error('No se encuentra token');
        res.status(403).json({ error: 'No se autoriza ingreso' });
    }

    admin.auth().verifyIdToken(idToken)
        .then((decodedToken) => {
            req.user = decodedToken;
            console.log(decodedToken);
            return db.collection('users').where('userId', '==', req.user.uid)
                .limit(1).get();
        }).then((data) => {
            req.user.handle = data.docs[0].data().handle;
            req.user.imageUrl = data.docs[0].data().imageUrl;
            return next();
        }).catch((err) => {
            console.error('Error al verificar token ->'+ err);
            return res.status(403).json(err);

        })
}

exports.uploadImages = (req, res) => {
    const BusBoy = require('busboy');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');

    const busboy = new BusBoy({ headers: req.headers });
    let imageFileName;
    let imageToBeUploaded = {};

    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        console.log('------ FieldName ---------');
        console.log(fieldname);
        console.log('-------------------------');
        console.log('------ FileName ---------');
        console.log(fieldname);
        console.log('-------------------------');
        console.log('------ Mimetype ---------');
        console.log(mimetype);
        console.log('-------------------------');
        if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
            return res.status(400).json({ error: 'Este tipo de archivos no esta permitido para imagen' });
        }
        const imageExtension = filename.split('.')[filename.split('.').length - 1]
        imageFileName = `${Math.round(Math.random()*100000000000)}.${imageExtension}`
        const filepath = path.join(os.tmpdir(), imageFileName);
        imageToBeUploaded = { filepath, mimetype };
        file.pipe(fs.createWriteStream(filepath));

    });

    busboy.on('finish', () => {
        storage.bucket().upload(imageToBeUploaded.filepath, {
            resumable: false,
            metadata: {
                metadata: imageToBeUploaded.mimetype
            }
        })
    }).then(() => {
        const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${imageFileName}?alt=media`;
        db.doc(`/users/${req.user.handle}`).update({ imageUrl });
    }).then(() => {
        return res.json({ message: 'Imagen cargada satisfactoriamente' });
    }).catch((err) => {
        return res.status(500).json({ error: err.code });
    });

    busboy.end(req.rawBody);



}

exports.addUserDetails = (req, res) => {
    let userDetails = reduceUserDetails(req.body);

    db.doc(`/users/${req.user.handle}`).update(userDetails)
        .then(() => {
            return res.json({ message: 'Detalles actualizados exitosamente' });
        }).catch((err) => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        })
}

exports.getAuthenticatedUser = (req, res) => {
    let userData = {};
    db.doc(`/users/${req.user.handle}`).get()
        .then((doc) => {
            if (doc.exists) {
                userData.userCredentials = doc.data();
                return db.collection('likes').where('userHandle', '==', req.user.handle).get()
            }
        }).then((data) => {
            userData.likes = [];
            data.forEach((doc) => {
                userData.likes.push(doc.data());

            });
            return db.collection('notifications').where('recipient', '==', req.user.handle)
                .orderBy('createdAt', 'desc').get()
        }).then((data) => {
            userData.notifications = [];
            data.forEach((doc) => {
                userData.notifications.push({
                    recipient: doc.data().recipient,
                    sender: doc.data().sender,
                    createdAt: doc.data().createdAt,
                    screamId: doc.data().screamId,
                    type: doc.data().type,
                    read: doc.data().read,
                    notificationId: doc.id
                })
            })
            return res.json(userData);
        })
        .catch((err) => {
            console.error(err);
            res.status(500).json({ error: err.code })
        })
}

exports.getUserDetails = (req, res) => {
    let userData = {};
    db.doc(`/users/${req.params.handle}`).get()
        .then((doc) => {
            if (doc.exists) {
                userData.user = doc.data();
                return db.collection('screams').where('userHandle', '==', req.params.handle)
                    .orderBy('createdAt', 'desc').get();
            } else {
                return res.status(404).json({ error: ' No se encuentra usuario' })
            }

        }).then((data) => {
            userData.screams = [];
            data.forEach((doc) => {
                userData.screams.push({
                    body: doc.data().body,
                    createdAt: doc.data().createdAt,
                    userHandle: doc.data().userHandle,
                    userImage: doc.data().userImage,
                    likeCount: doc.data().likeCount,
                    commentCount: doc.data().commentCount,
                    screamdId: doc.id
                })
            });
            return res.json(userData);

        }).catch((err) => {
            console.error(err);
            res.status(500).json({ error: err.code });
        })
}

exports.markNotificationsRead = (req, res) => {
    let batch = db.batch();
    req.body.map((notificationId) => {
        const notification = db.doc(`/notification/${notificationId}`);
        batch.update(notification, { read: true });
    });
    batch.commit().then(() => {
        return res.json({ message: 'Notificaciones marcadas como leidas' });
    }).catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
    })
}

function validateNewUser(newUser) {
    let error = {};
    // valida Mail
    if (isEmpty(newUser.email)) error.email = 'El correo no puede estar en blanco';
    if (!isEmail(newUser.email)) error.email = 'El correo ingresado no es valido';
    if (!validaPassword(newUser.password, newUser.confirmPassword)) error.password = 'Las contraseñas ingresadas deben ser iguales';
    if (isEmpty(newUser.handle)) error.handle = 'El usuario no puede estar en blanco';
    return error;
}

function validateLogin(user) {
    return ((!isEmpty(user.email)) && !isEmpty(user.password)) ? true : false;

}

function isEmpty(text) {
    return (text.trim() === '') ? true : false;
}

function isEmail(email) {
    let regExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return (email.match(regExp)) ? true : false;
}

function validaPassword(pass, confirmPass) {
    return (pass === confirmPass) ? true : false;
}

function reduceUserDetails(data) {
    let userDetails = {};
    if (!isEmpty(data.bio.trim())) userDetails.bio = data.bio;
    if (!isEmpty(data.website.trim())) {
        if (data.website.trim().substring(0, 4) !== 'http') {
            userDetails.website = `http://${data.website.trim()}`;
        } else userDetails.website = data.website;
    }
    if (!isEmpty(data.location.trim())) userDetails.location = data.location;
    return userDetails;

}