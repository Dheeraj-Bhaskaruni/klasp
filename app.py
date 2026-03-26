"""Klasp — App factory."""

from flask import Flask
import platform
import config


def create_app():
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.secret_key = config.SECRET_KEY

    # Register API blueprints (microservices)
    from api import session, lessons, groups, auth
    app.register_blueprint(session.bp)
    app.register_blueprint(lessons.bp)
    app.register_blueprint(groups.bp)
    app.register_blueprint(auth.bp)

    # Page routes
    @app.route("/")
    def index():
        from flask import render_template
        has_say = platform.system() == "Darwin"
        return render_template("index.html", has_server_tts=has_say)

    return app


if __name__ == "__main__":
    app = create_app()
    print("\n  Klasp")
    print("  Open http://localhost:5002 in your browser\n")
    app.run(debug=True, port=5002, host="0.0.0.0")
