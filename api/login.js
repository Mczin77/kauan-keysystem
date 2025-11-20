module.exports = (req, res) => {
    const user = req.query.user;
    const pass = req.query.pass;

    if (user === "admin" && pass === "admin123") {
        return res.json({success:true, token:"OK"});
    }
    res.json({success:false});
};
