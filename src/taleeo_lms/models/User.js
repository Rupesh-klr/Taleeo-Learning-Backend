// This defines what a User object looks like
class User {
    constructor(id, name, email, password, role, phone, batchId = null) {
        this.id = id;
        this.name = name;
        this.email = email.toLowerCase();
        this.password = password;
        this.role = role; // 'admin' or 'student'
        this.phone = phone;
        this.batchId = batchId;
        this.firstLoginDone = false;
        this.createdAt = new Date();
    }
}

module.exports = User;