const functions = require('firebase-functions');
const app = require('express')();
const firebase = require('firebase/app');

const admin = require('firebase-admin');

const firebaseConf = require('./firebaseConfig');
const cors = require('cors');


admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket: firebaseConf.firebaseConfig.storageBucket
    
})
firebase.initializeApp(firebaseConf.firebaseConfig);




// api files
const screams = require('./src/screams');
const users = require('./src/users');

// Screams API
app.use(cors());
app.get('/screams', screams.list);
app.post('/scream', users.fbAuth, screams.new);
app.get('/scream/:screamId', screams.getScream);
app.post('/scream/:screamId/comment', users.fbAuth, screams.commentOnScream);
app.get('/scream/:screamId/like', users.fbAuth, screams.likeScream);
app.get('/scream/:screamId/unlike', users.fbAuth, screams.unLikeScream);
app.delete('/scream/:screamId', users.fbAuth, screams.deleteScream);

// Auth API
app.post('/signup', users.signUp);
app.post('/login', users.login);
//user API
app.post('/user/image', users.fbAuth, users.uploadImages);
app.post('/user', users.fbAuth, users.addUserDetails);
app.get('/user', users.fbAuth, users.getAuthenticatedUser);
app.get('/user/:userHandle', users.getUserDetails);
app.post('/notifications', users.fbAuth, users.markNotificationsRead);
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// Hacer funcionar function con express
exports.api = functions.region('us-east1').https.onRequest(app);

//Notificaciones
exports.createNotificationsOnLike = functions.region('us-east1').firestore.document('likes/{id}').onCreate((snapshot) => {
    db.doc(`/screams/${snapshot.data().screamId}`).get()
        .then((doc) => {
            if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle) {
                return db.doc(`/notifications/${snapshot.id}`).set({
                    createdAt: new Date().toISOString(),
                    recipient: doc.data().userHandle,
                    sender: snapshot.data().userHandle,
                    type: 'like',
                    read: false,
                    screamId: doc.id
                });
            }

        }).catch((err) => {
            console.error(err);

        })
});
exports.createNotificationsOnComment = functions.region('us-east1').firestore.document('comments/{id}').onCreate((snapshot) => {
    db.doc(`/screams/${snapshot.data().screamId}`).get()
        .then((doc) => {
            if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle) {
                return db.doc(`/notifications/${snapshot.id}`).set({
                    createdAt: new Date().toISOString(),
                    recipient: doc.data().userHandle,
                    sender: snapshot.data().userHandle,
                    type: 'comment',
                    read: false,
                    screamId: doc.id
                });
            }

        }).catch((err) => {
            console.error(err);

        })
})

exports.deleteNotificationOnUnlike = functions.region('us-east1').firestore.document('likes/{id}').onDelete((snapshot) => {
    return db.doc(`/notifications/${snapshot.id}`)
        .delete()
        .catch((err) => {
            console.error(err);

        });
})

exports.onUserImageChange = functions.region('us-east1').firestore.document('/users/{userId}').onUpdate((change) => {
    console.log(change.before.data());
    console.log(change.after.data());
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
        console.log('ha cambiado la imagen');
        let batch = db.batch();
        return db.collection('scream').where('userHandle', '==', change.before.data().handle).get().then((data) => {
            data.forEach((doc) => {
                const scream = db.doc(`/screams/${doc.id}`);
                batch.update(scream, { userImage: change.after.data().imageUrl });
            })
            return batch.commit();
        })
    } else return true;

})

exports.onScreamDeleted = functions.region('us-east1').firestore.document('/screams/{screamId}').onDelete((snapshop, context) => {
    const screamId = context.params.screamId;
    const batch = db.batch();
    return db.collection('comments').where('screamId', '==', screamId).get().then((data) => {
            data.forEach((doc) => {
                batch.delete(db.doc(`/comments/${doc.id}`))
            });
            return db.collection('likes').where('screamId', '==', screamId).get();
        }).then((data) => {
            data.forEach((doc) => {
                batch.delete(db.doc(`/likes/${doc.id}`))
            });
            return db.collection('notifications').where('screamId', '==', screamId).get();
        })
        .then((data) => {
                data.forEach((doc) =>{
                    batch.delete(db.doc(`/notifications/${doc.id}`))
                });
            return batch.commit();
        }).catch((err) => {
    console.error(err);
})
})