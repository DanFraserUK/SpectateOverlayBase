UI.widgets.Code60 = React.createClass({
	render: function() {
		var self = this;
		return (
			<div className="code60Container">
				<img className="code60Img animated flash infinite" src="img/code60.png" />
				<div className="code60">{UI.getStringTranslation("code60Widget", "code60")}</div>
			</div>
		);
	}
});
