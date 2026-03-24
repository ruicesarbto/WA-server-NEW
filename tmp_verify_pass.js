const bcrypt = require('bcryptjs');

const hashes = {
    'admin@admin.com': '$2b$10$OUmfMxfNYQOw4yGtYWzQV./vpMHKYDXzkn6q2FK58hO8uzYuqdFcq',
    'user@user.com': '$2b$10$Gp2XXKLkc9EtwaQVNNbIhOnz9o9lvsTOhqhAczUF8780RzI.gpBBy'
};

const passwords = ['admin', 'user', '12345678', 'admin123'];

async function verify() {
    for (const [email, hash] of Object.entries(hashes)) {
        console.log(`Checking ${email}...`);
        for (const pass of passwords) {
            const match = await bcrypt.compare(pass, hash);
            if (match) {
                console.log(`  MATCH: ${pass}`);
            }
        }
    }
}

verify();
