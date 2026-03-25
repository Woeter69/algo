import os
import sys
from flask import Flask
from flask_bcrypt import Bcrypt

# Add the parent directory to the path to allow for package imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import db and other components that will be initialized
from algo import db
# Import blueprints that will be registered
# from .blueprints import core, auth, profile, profile, admin, connections, chat, settings
from .blueprints import core, auth, profile, dashboard

# Initialize extensions without an app
bcrypt = Bcrypt()

def create_app(test_config=None):
    """Create and configure an instance of the Flask application."""
    app = Flask(__name__, instance_relative_config=True,
                template_folder="../../templates",
                static_folder="../../static")

    # Load default configuration
    app.config.from_mapping(
        SECRET_KEY=os.environ.get("SECRET_KEY", "dev-secret"),
        # Other default configs
    )

    if test_config is None:
        # Load the instance config, if it exists, when not testing
        app.config.from_pyfile("config.py", silent=True)
    else:
        # Load the test config if passed in
        app.config.update(test_config)

    # Ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    # Initialize Flask extensions
    bcrypt.init_app(app)
    db.init_app(app)

    # Register blueprints
    app.register_blueprint(core.bp)
    app.register_blueprint(auth.bp)
    app.register_blueprint(profile.bp)
    app.register_blueprint(dashboard.bp)
    # A simple hello route to test app factory
    @app.route('/hello')
    def hello():
        return 'Hello, World!'

    return app
urn app
rld!'

    return app
urn app
