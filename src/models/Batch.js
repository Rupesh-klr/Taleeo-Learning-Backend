class Batch {
    constructor(id, name, type, start, end, timing, zoomDetails) {
        this.id = id;
        this.name = name;
        this.type = type; // 'weekend' or 'weekday'
        this.start = start;
        this.end = end;
        this.timing = timing;
        this.zoomDetails = zoomDetails; // { link, id, pass }
        this.active = true;
        this.students = []; // Array of student IDs
    }
}

module.exports = Batch;