UI.widgets.FocusedDriver = React.createClass({
	componentDidMount: function() {
		var self = this;

		// Hide widgets that use the same screen space
		// UI.state.activeWidgets.CompareRace.active = false;
		// io.emit('setState', UI.state);

		function updateInfo() {
			var initialState = {};
			if (self.state.currentSlot !== UI.state.focusedSlot) {
				initialState.bufferedCurrentLapInfo = JSON.parse(JSON.stringify(self.defaultSectorValues));
			}
			initialState.currentSlot = UI.state.focusedSlot;
			self.setState(initialState);

			UI.batch({
				'vehicleInfo': function(done) {
					r3e.getVehicleInfo({
						'slotId': UI.state.focusedSlot
					}, done)
				},
				'pushToPassInfo': function(done) {
					r3e.getPushToPassInfo({
						'slotId': UI.state.focusedSlot
					}, done)
				},
				'pitInfo': function(done) {
					r3e.getPitInfo({
						'slotId': UI.state.focusedSlot
					}, done);
				},
				'extendedInfo': function(done) {
					r3e.getExtendedInfo({
						'slotId': UI.state.focusedSlot
					}, function(data) {
						if (self.sectorTimesFrozen) {
							return done(self.state.extendedInfo);
						}

						self.handleSectorTimes(data);
						done(data);
					});
				},
				'driverInfo': function(done) {
					if (self.sectorTimesFrozen) {
						return done(self.state.driverInfo);
					}

					r3e.getDriversInfo(function(driversInfo) {
						done(driversInfo.driversInfo.filter(function(driver) {
							return driver.slotId === UI.state.focusedSlot;
						})[0] || {});
					});
				},
				'driversInfo': r3e.getDriversInfo
			}, self.setState.bind(self));
		}
		updateInfo();

		self.updateInterval = setInterval(updateInfo, UI.spectatorUpdateRate*2);
	},
	handleSectorTimes: function(data) {
		var self = this;
		if (self.sectorTimesFrozen) {
			return;
		}
		var stateChanges = self.state;
		var bufferedCurrentLapInfo = self.state.bufferedCurrentLapInfo;
		bufferedCurrentLapInfo.valid = data.currentLapInfo.valid;

		if (bufferedCurrentLapInfo.sector3.time > data.currentLapInfo.sector3) {
			bufferedCurrentLapInfo.sector3.finished = true;

			self.setState(stateChanges);

			self.sectorTimesFrozen = true;
			setTimeout(function() {
				self.sectorTimesFrozen = false;
				self.setState({
					'bufferedCurrentLapInfo': JSON.parse(JSON.stringify(self.defaultSectorValues))
				});
			}, 5000);
			return;

		} else {
			bufferedCurrentLapInfo.sector3.time = data.currentLapInfo.sector3;
		}

		if (!bufferedCurrentLapInfo.sector1.finished || bufferedCurrentLapInfo.sector1.time !== data.currentLapInfo.sector1) {
			if (bufferedCurrentLapInfo.sector1.time === data.currentLapInfo.sector1 && data.currentLapInfo.sector2 !== -1) {
				bufferedCurrentLapInfo.sector1.finished = true;
			} else {
				bufferedCurrentLapInfo.sector1.finished = false;
				bufferedCurrentLapInfo.sector1.time = data.currentLapInfo.sector1;
			}
		}

		if (!bufferedCurrentLapInfo.sector2.finished || bufferedCurrentLapInfo.sector2.time !== data.currentLapInfo.sector2) {
			if (bufferedCurrentLapInfo.sector2.time === data.currentLapInfo.sector2 && data.currentLapInfo.sector3 !== -1) {
				bufferedCurrentLapInfo.sector2.finished = true;
			} else {
				bufferedCurrentLapInfo.sector2.finished = false;
				bufferedCurrentLapInfo.sector2.time = data.currentLapInfo.sector2;
			}
		}

		self.setState(stateChanges);
	},
	sectorTimesFrozen: false,
	componentWillUnmount: function() {
		clearInterval(this.updateInterval);
	},
	defaultSectorValues: {
		'valid': false,
		'sector1': {'time': -1, 'finished': false},
		'sector2': {'time': -1, 'finished': false},
		'sector3': {'time': -1, 'finished': false},
	},
	getInitialState: function() {
		return {
			'driverInfo': {},
			'driversInfo': {},
			'pitInfo': {},
			'vehicleInfo': {},
			'currentSlot': -1,
			'bufferedCurrentLapInfo': JSON.parse(JSON.stringify(this.defaultSectorValues))
		};
	},
	formatTime: function(ms) {
		var seconds = ms/1000;
		var minutesLeft = Math.floor(seconds/60);
		var secondsLeft = Math.floor(seconds-(minutesLeft*60));
		var msLeft = Math.floor((seconds - Math.floor(seconds))* 1000);
		return minutesLeft+':'+secondsLeft+'.'+msLeft;
	},
	bestLapTime: function() {
		var self = this;
		var info = self.state.driverInfo.scoreInfo;
		if (info.bestLapInfo.valid) {
			return <div className="best-lap-time">Best lap time: {this.formatTime(info.bestLapInfo.sector3)}</div>
		}
		return null;
	},
	fixName: function(str) {
		str = UI.fixName(str);
		var parts = str.split(' ');
		parts[parts.length-1] = parts[parts.length-1].toUpperCase();
		return parts.join(' ');
	},
	getSectorItem: function(name) {
		var self = this;

		var sector = self.state.bufferedCurrentLapInfo[name];
		var personalBest = self.state.driverInfo.scoreInfo.bestLapInfo[name]
		if (personalBest === -1) {
			personalBest = sector.time;
		}
		var globalBest;
		try {
			globalBest = self.state.driversInfo.driversInfo[0].scoreInfo.bestLapInfo[name];
		} catch(e) {}
		if (globalBest === -1) {
			globalBest = personalBest;
		}

		var sectorMap = {"sector1": UI.getStringTranslation("focusedDriverWidget", "sector1"),
		"sector2": UI.getStringTranslation("focusedDriverWidget", "sector2"),
		"sector3": UI.getStringTranslation("focusedDriverWidget", "sector3")};

		var classes = cx({
			'sector-entry': true
			, 'finished': sector.finished
			, 'active': sector.time > 0
			, 'personal-best': sector.time <= personalBest
			, 'global-best': sector.time <= globalBest
		});
		if (sector.time === -1) {
			return null;
		}
		if (sector.finished && sector.time-globalBest !== 0) {
			return <li className={classes}>
				{sectorMap[name] + " - " + UI.formatTime(sector.time, {ignoreSign: true})} ({UI.formatTime(sector.time-globalBest)})
			</li>
		} else {
			return <li className={classes}>
				{sectorMap[name] + " - " + UI.formatTime(sector.time, {ignoreSign: true})}
			</li>;
		}
	},
	getExtraInfo: function() {
		var self = this;
		if (UI.state.sessionInfo.type.match(/^(qualify|practice)/i)) {
			return <div className="extra-info">
				<ul className="sectors">
					{self.getSectorItem('sector1')}
					{self.getSectorItem('sector2')}
					{self.getSectorItem('sector3')}
				</ul>
			</div>
		}
	},
	getClassPosition: function(classId) {
		var self = this;
		var classColour = "rgba(38, 50, 56, 0.8)";
		var driverInfo = self.state.driverInfo;

		if (UI.getClassColour(classId) != null) {
			classColour = UI.getClassColour(classId);
		}

		const divStyle = {
				background: classColour
		};

		return <div className="positionInClass" style={divStyle}>P{driverInfo.scoreInfo.positionClass}</div>
	},
	getTeamName: function(teamId, portalId) {
		var self = this;
		var teamName = "";

		if (!window.settings.teamEvent) {
			var portalTeamName = UI.getUserInfo(portalId).team;
			if (UI.state.controllerOptions.options.showPortalTeam.value === "true" && portalTeamName != null && portalTeamName.length > 0) {
				teamName = portalTeamName;
			} else if (UI.state.controllerOptions.options.showPortalTeam.value === "true" && portalTeamName != null && portalTeamName.length === 0) {
				teamName = UI.getStringTranslation("focusedDriverWidget", "privateer");
			} else if (r3eData.teams[teamId] != null) {
				teamName = r3eData.teams[teamId].Name;
			}

			// shorten long team names
			if (teamName.length > 40) {
				teamName = teamName.substring(0, 40) + "..";
			}
		}

		return teamName;
	},
	getPtpState: function() {
		var self = this;
		if (self.state.pushToPassInfo.active) {
			return <div className="icon animated infinite flash">{UI.getStringTranslation("focusedDriverWidget", "ptp")}</div>
		} else {
			return <div className="icon">{UI.getStringTranslation("focusedDriverWidget", "ptp")}</div>
		}
	},
	getPersonalBestTime: function(driverInfo) {
		if(driverInfo.scoreInfo.bestLapInfo.sector3 !== -1) {
			var isFastestInQuali = (UI.state.sessionInfo.type === 'QUALIFYING' || UI.state.sessionInfo.type === 'PRACTICE') && driverInfo.scoreInfo.positionOverall === 1;
			if (isFastestInQuali) {
				return <div className="best-time fastest">{UI.formatTime(driverInfo.scoreInfo.bestLapInfo.sector3, {ignoreSign: true})}</div>
			} else {
				return <div className="best-time">{UI.formatTime(driverInfo.scoreInfo.bestLapInfo.sector3, {ignoreSign: true})}</div>
			}
		} else {
			return null;
		}
	},
	render: function() {
		var self = this;
		var pitInfo = self.state.pitInfo;
		var driverInfo = self.state.driverInfo;
		if (!driverInfo.name) {
			return null;
		}

		// show exit animation only in races, if the user has it enabled in the control options and when DRS or PTP us bit being deployed.
		var focusedDriverClasses = cx({
			'hide-flags': UI.state.activeWidgets.FocusedDriver.disableFlags
			, 'focused-driver-info': true
		});

		// On end phase user portalId is not sent anymore so do not show
		if (UI.state.sessionInfo.type === 'QUALIFYING'
			&& UI.state.sessionInfo.timeLeft <= UI.state.controllerOptions.options.qualifyingResultsDisplayTime.value
			&& UI.state.activeWidgets.Results.active) {
			return null;
		}

		// hide when the event info widget is open.
		if (UI.state.activeWidgets.EventInfo.active === true) {
			return null;
		}

		return (
			<div className={focusedDriverClasses} key={self.state.driverInfo.portalId}>
				<div className="inner animated fadeIn delay-1s">
					<div className="top">
						{self.state.pushToPassInfo.allowed && UI.state.sessionInfo.type.match(/^race/i) ?
							<div className="ptpRemaining">{UI.getStringTranslation("focusedDriverWidget", "ptp")}: {self.state.pushToPassInfo.amountLeft}</div>
							:
							null
						}
						{self.getPersonalBestTime(driverInfo)}
						{ UI.state.controllerOptions.options.multiclass.value === "true" ?
							self.getClassPosition(driverInfo.classId)
						:
							null
						}
					</div>
					<div className="main">
					<div className="positionContainer"><div className="position">{driverInfo.scoreInfo.positionOverall}</div></div>
					<div className="flag-container">
					{window.settings.offline === true || UI.state.controllerOptions.options.showPortalAvatar.value === "true" ?
						<img className="flag" src={UI.getUserInfo(driverInfo.portalId).avatar} />
					:
						<img className="flag" src={'/img/flags/'+UI.getUserInfo(driverInfo.portalId).country+'.png'} />
					}
					</div>
					<div className="driverInfoDetails">
					  { window.settings.teamEvent ?
							<div className="teamEventName">{driverInfo.name.substr(driverInfo.name.indexOf(" ") + 1).toUpperCase()}</div>
						:
							<div className="name">{self.fixName(driverInfo.name)}</div>
						}
						<div className="team">{self.getTeamName(driverInfo.teamId, driverInfo.portalId)}</div>
					</div>
					{UI.state.controllerOptions.options.showTyreCompound.value === "true" && r3eTyreDB.classes[driverInfo.classId] != null ?
						<div className="tyre">
							<img src={'/img/tyres/'+pitInfo.tyreType+'.png'} />
						</div>
							:
							<div className="manufacturer">
								<img src={'/render/'+driverInfo.manufacturerId+'/small/?type=manufacturer'}/>
							</div>
						}
						{UI.state.controllerOptions.options.showLiveryPreview.value === "true" ?
						<div className="vehicle">
							<img src={`/render/${driverInfo.liveryId}/small/?type=livery`} />
						</div>
						:
							null
						}
					</div>

					<div className="assists">
						{self.state.pushToPassInfo.allowed ?
							<div className={cx({'ptp': true, 'active': self.state.pushToPassInfo.active && UI.state.sessionInfo.type.match(/^race/i)})}>
								{self.getPtpState()}
								{ UI.state.sessionInfo.type === 'PRACTICE' ?
									<div className="text">{UI.getStringTranslation("focusedDriverWidget", "remaining")} - ∞</div>
								:
									<div className="text">{UI.getStringTranslation("focusedDriverWidget", "remaining")} - {self.state.pushToPassInfo.amountLeft}</div>
								}
							</div>
							:
							null
						}

						<div className={cx({'drs': true, 'active': self.state.vehicleInfo.drsEnabled && UI.state.sessionInfo.type.match(/^race/i)})}>
							<div className={cx({'icon animated infinite flash': true, 'active': self.state.vehicleInfo.drsEnabled})}>{UI.getStringTranslation("focusedDriverWidget", "drs")}</div>
							<div className={cx({'text': true, 'active': self.state.vehicleInfo.drsEnabled})}>{UI.getStringTranslation("focusedDriverWidget", "remaining")} - {self.state.vehicleInfo.drsLeft}</div>
						</div>

						{UI.state.controllerOptions.options.showVehicleInfo.value === "true" ?
							<div className={cx({'params': self.state.vehicleInfo.speed > 0})}>
								<div className={cx({'gearContainer': true})}><div className="gear">{self.state.vehicleInfo.gear}</div></div>
								<div className={cx({'rpmContainer': true})}><div className="rpm">{self.state.vehicleInfo.rpm} RPM</div></div>
								<div className={cx({'speedContainer': true})}><div className="speed">{self.state.vehicleInfo.speed} KM/H</div></div>
							</div>
							:
							null
						}
					</div>
				</div>

				<div className="bottom">
					{self.getExtraInfo()}
				</div>

			</div>
		);
	}
});
