const firebase = require('firebase');



const db = firebase.firestore();
exports.list = (req, res) => {
    db.collection('screams').orderBy('createdAt', 'desc').get().then((data) => {
        let screams = [];
        data.forEach((doc) => {
            screams.push({
                screamId: doc.id,
                body: doc.data().body,
                userHandle: doc.data().userHandle,
                createdAt: doc.data().createdAt,
                commentCount: doc.data().commentCount,
                commentCount: doc.data().commentCount,
                userImage: doc.data().userImage
            });
        });
        return res.json(screams);
    }).catch((error) => {
        console.error(error);
    });
}

exports.new = (req, res) => {
    const newScream = {
        body: req.body.body,
        userHandle: req.user.handle,
        userImage: req.user.imageUrl,
        createdAt: new Date().toISOString(),
        likeCount: 0,
        commentCount: 0
    };

    db.collection('screams').add(newScream).then((doc) => {
        let resScream = newScream;
        resScream.screamId = doc.id;
        res.json({ resScream });
    }).catch((err) => {
        res.status(500).json({ error: ' A ocurrido algo inesperado.' })
    })
}
exports.getScream = (req, res) => {
    let screamData = {};
    db.doc(`/screams/${req.params.screamId}`).get()
        .then((doc) => {
            if (!doc.exists) {
                return res.status(404).json({ error: 'No se encuentra scream' });
            }
            screamData = doc.data();
            screamData.screamId = doc.id;
            return db.collection('comments').orderBy('createdAt', 'desc').where('screamId', '==', req.params.screamId).get();
        }).then((data) => {
            screamData.comments = [];
            data.forEach((doc) => {
                screamData.comments.push(doc.data());
            });
            return res.json(screamData);

        }).catch((err) => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        })
}
exports.commentOnScream = (req, res) => {
    if (req.body.body.trim() === '') return res.status(400).json({ comment: 'Comentario no puede estar vacio' });

    const newComment = {
        body: req.body.body,
        createdAt: new Date().toISOString(),
        screamId: req.params.screamId,
        userHandle: req.user.handle,
        userImage: req.user.imageUrl
    };
    db.doc(`/screams/${req.params.screamId}`).get()
        .then((doc) => {
            if (!doc.exists) {
                return res.status(404).json({ error: 'No se encuentra scream' })
            }
            return doc.ref.update({ commentCount: doc.data().commentCount + 1 })

        }).then(() => {
            return db.collection('comments').add(newComment);
        })
        .then(() => {
            return res.json(newComment)
        }).catch((err) => {
            console.error(err);
            return res.status(500).json({ error: 'Algo ocurrio mientra se ingresaba el comentario' });
        })
}

exports.likeScream = (req, res) => {
    const likeDocument = db.collection('likes').where('userHandle', '==', req.user.userHandle)
        .where('screamId', '==', req.params.screamId).limit(1);

    const screamDoc = db.doc(`/screams/${req.params.creamId}`);

    let screamData;

    screamDoc.get().then((doc) => {
        if (doc.exists) {
            screamData = doc.data();
            screamData.screamId = doc.id;
            return likeDocument.get();
        } else {
            return res.status(404).json({ error: 'No se encuentra scream' })
        }
    }).then((data) => {
        if (data.empty) {
            return db.collection('likes').add({
                screamId: req.params.screamId,
                userHandle: req.user.handle
            }).then(() => {
                screamData.likeCount++
                    return screamDoc.update({ likeCount: screamData.likeCount });
            }).then(() => {
                return res.json(screamData);
            })
        } else {
            return res.status(400).json({ error: ' Scream ya tiene like asociado' })
        }
    }).catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
    });
}

exports.unLikeScream = (req, res) => {
    const likeDocument = db.collection('likes').where('userHandle', '==', req.user.userHandle)
        .where('screamId', '==', req.params.screamId).limit(1);

    const screamDoc = db.doc(`/screams/${req.params.creamId}`);

    let screamData;

    screamDoc.get().then((doc) => {
        if (doc.exists) {
            screamData = doc.data();
            screamData.screamId = doc.id;
            return likeDocument.get();
        } else {
            return res.status(404).json({ error: 'No se encuentra scream' })
        }
    }).then((data) => {
        if (!data.empty) {
            return db.doc(`/likes/${data.docs[0].id}`).delete()
                .then(() => {
                    screamData.likeCount--;
                    return screamDoc.update({ likeCount: screamData.likeCount });
                }).then(() => {
                    res.json(screamData);
                })
        } else {
            return res.status(400).json({ error: ' Scream ya tiene like asociado' })
        }
    }).catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
    });
}
exports.deleteScream = (req, res) => {
    const document = db.doc(`/screams/${req.params.screamId}`);
    document.get()
        .then((doc) => {
            if (!doc.exists) {
                return res.status(404).json({ error: 'No se encuentra Scream' });
            }
            if (doc.data().userHandle !== req.user.handle) {
                return res.status(403).json({ error: ' No autorizado' })
            } else {
                return document.delete();
            }
        }).then(() => {
            return res.json({ message: ' Scream eliminado exitosamente' })
        })
        .catch((err) => {
            console.error(err);
            res.status(500).json({ error: err.code });
        })
}