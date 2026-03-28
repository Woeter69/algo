-- Get the community ID for CIC and create it if not exists
DO $$
DECLARE
    cic_community_id INT;
    admin_user_id INT;
BEGIN
    -- Get an admin user
    SELECT user_id INTO admin_user_id 
    FROM users 
    WHERE role = 'admin' 
    ORDER BY user_id ASC
    LIMIT 1;
    
    -- If no admin user exists, try to get the first user
    IF admin_user_id IS NULL THEN
        SELECT user_id INTO admin_user_id 
        FROM users 
        ORDER BY user_id ASC
        LIMIT 1;
    END IF;
    
    -- If still no user exists, create a default admin
    IF admin_user_id IS NULL THEN
        INSERT INTO users (firstname, lastname, email, username, password, role, verified, verification_status)
        VALUES ('System', 'Admin', 'admin@cic.du.ac.in', 'admin', '$2b$12$6y/9P.P.O.v6Z.O.v6Z.O.v6Z.O.v6Z.O.v6Z.O.v6Z.O.v6Z.O.v6Z', 'admin', TRUE, 'verified')
        RETURNING user_id INTO admin_user_id;
    END IF;

    -- Insert Cluster Innovation Centre community if not exists
    INSERT INTO communities (name, description, college_code, location, established_year, website, created_by)
    VALUES (
        'Cluster Innovation Centre',
        'Delhi University''s premier innovation hub fostering creativity, entrepreneurship, and technological advancement among students and alumni.',
        'CIC',
        'University of Delhi, North Campus',
        2017,
        'https://cic.du.ac.in',
        admin_user_id
    ) ON CONFLICT (name) DO NOTHING;

    -- Get CIC community ID
    SELECT community_id INTO cic_community_id 
    FROM communities 
    WHERE name = 'Cluster Innovation Centre';
    
    -- Ensure the admin user is a member of the CIC community
    INSERT INTO community_members (community_id, user_id, role)
    VALUES (cic_community_id, admin_user_id, 'admin')
    ON CONFLICT (community_id, user_id) DO NOTHING;
    
    -- Create default channels for CIC
    INSERT INTO channels (community_id, name, description, channel_type, created_by, position_order) VALUES
    (cic_community_id, 'general', 'General discussion for all CIC members', 'text', admin_user_id, 1),
    (cic_community_id, 'announcements', 'Official announcements from CIC administration', 'announcement', admin_user_id, 2),
    (cic_community_id, 'introductions', 'Introduce yourself to the CIC community', 'text', admin_user_id, 3),
    (cic_community_id, 'projects', 'Share and discuss your innovation projects', 'text', admin_user_id, 4),
    (cic_community_id, 'startups', 'Startup discussions and entrepreneurship', 'text', admin_user_id, 5),
    (cic_community_id, 'job-opportunities', 'Job postings and career opportunities', 'text', admin_user_id, 6),
    (cic_community_id, 'tech-talk', 'Technology discussions and trends', 'text', admin_user_id, 7),
    (cic_community_id, 'events', 'CIC events, workshops, and meetups', 'text', admin_user_id, 8),
    (cic_community_id, 'alumni-connect', 'Connect with CIC alumni network', 'text', admin_user_id, 9),
    (cic_community_id, 'help-support', 'Get help and support from the community', 'text', admin_user_id, 10),
    (cic_community_id, 'random', 'Random discussions and off-topic conversations', 'text', admin_user_id, 11)
    ON CONFLICT DO NOTHING;
    
    -- Create some sample welcome messages
    INSERT INTO channel_messages (channel_id, user_id, content, message_type) 
    SELECT 
        c.channel_id,
        admin_user_id,
        CASE 
            WHEN c.name = 'general' THEN 'Welcome to the Cluster Innovation Centre community! 🎉 This is our main discussion channel.'
            WHEN c.name = 'announcements' THEN '📢 This channel is for official CIC announcements. Stay tuned for important updates!'
            WHEN c.name = 'introductions' THEN '👋 New to CIC? Introduce yourself here! Tell us about your background, interests, and what you hope to achieve.'
            WHEN c.name = 'projects' THEN '🚀 Share your innovative projects here! Whether it''s a work in progress or completed project, we''d love to see what you''re building.'
            WHEN c.name = 'startups' THEN '💡 Got a startup idea? Looking for co-founders? This is the place to discuss entrepreneurship and startup opportunities.'
            WHEN c.name = 'job-opportunities' THEN '💼 Job postings, internship opportunities, and career advice. Help each other grow professionally!'
            WHEN c.name = 'tech-talk' THEN '💻 Discuss the latest in technology, programming, AI, and emerging trends. Share articles, tutorials, and insights.'
            WHEN c.name = 'events' THEN '📅 Stay updated on CIC events, workshops, hackathons, and meetups. Don''t miss out on networking opportunities!'
            WHEN c.name = 'alumni-connect' THEN '🎓 Connect with our amazing alumni network. Seek mentorship, share experiences, and build lasting relationships.'
            WHEN c.name = 'help-support' THEN '🆘 Need help with something? Ask the community! We''re here to support each other.'
            WHEN c.name = 'random' THEN '🎲 For everything else! Memes, casual conversations, and anything that doesn''t fit in other channels.'
        END,
        'system'
    FROM channels c
    WHERE c.community_id = cic_community_id
    AND NOT EXISTS (
        SELECT 1 FROM channel_messages cm WHERE cm.channel_id = c.channel_id
    );
    
END $$;